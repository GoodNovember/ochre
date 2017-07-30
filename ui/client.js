let MODE = "local"
let MY_WS_ID = null
let REMOTE_ID = null
let local_library = null
let libraryMap = new Map()

const {ipcRenderer} = require('electron')

let socket = null

ipcRenderer.on("server-is-created", (event, arg)=>{
	console.log("Server is created!")
})
ipcRenderer.on("server-is-alive", (event, url)=>{
	console.log("Server is alive!", url)
	if(!socket && MODE == "local"){
		connectToServer(url)
	}
})
ipcRenderer.on("local-library", (event, library)=>{
	if(!local_library){
		libraryMap = new Map()
		var promises = library.map((item)=>{
			return downloadAndDecodeToBuffer(item.path).then((buffer)=>{
				item.buffer = buffer
				return item
			})
		})
		Promise.all(promises).then((library)=>{
			local_library = library
			library.map((item)=>{
				libraryMap.set(item.id, item)
			})
			console.log("Library Download Complete.")
		}).catch((error)=>{
			console.error(error)
		})
	}
})

const actx = new AudioContext()
const transDest = actx.createMediaStreamDestination()
const pc = new RTCPeerConnection()


function connectToServer(url){
	socket = new WebSocket(url)

	socket.onmessage = (event)=>{
		var message = JSON.parse(event.data)
		// console.log("[client] got message:", data)

		if(message.type === "identity"){ // get a name from the server.
			MY_WS_ID = message.data
			console.log("[client] my name is:", MY_WS_ID)
			sendToServer(null, MODE, "my-mode")
		}
		if(message.from && message.from !== MY_WS_ID){
			REMOTE_ID = message.from
		}
		if(message.type === "ice-candidate"){
			if(message.data){
				// console.log("[client] Got ICE Candidate!")
				var candidate = new RTCIceCandidate(message.data)
				if(candidate){
					// console.log("[client] Candidate to add:", candidate)
					pc.addIceCandidate(candidate)
				}
			}
		}
		if(message.type === "offer"){
			if(MODE === "remote"){
				console.log("[client] Got an offer from the server")
				var description = new RTCSessionDescription(message.data)
				pc.setRemoteDescription(description).then(()=>{
					pc.createAnswer().then((answer)=>{
						return pc.setLocalDescription(answer)
					}).then(()=>{
						sendToServer(REMOTE_ID, pc.localDescription.toJSON(), "answer")
					})
				})
			}else{
				console.log("[client] I got an offer, but I ignored it because I broadcast for a living.")
			}
		}
		if(message.type === "make-offer"){
			if(MODE === "local"){
				console.log("[client] Server requested that I make an offer.")
				pc.createOffer().then((offer)=>{
					return pc.setLocalDescription(offer)
				}).then(()=>{
					sendToServer(message.data, pc.localDescription.toJSON(), "offer")
				})
			}else{
				console.log("[client] Somehow, I got a request to make an offer, but I am just here to listen.")
			}
		}
		if(message.type === "answer"){
			if(MODE === "local"){
				console.log("[client] Got an answer to my offer.")
				var description = new RTCSessionDescription(message.data)
				pc.setRemoteDescription(description).catch((error)=>{
					console.error(error)
				})
			}else{
				console.log("[client] Somehow, I got an answer to an offer that I sent, but I should not have sent any offers... I'm just here to listen.")
			}
		}
	}

}

function sendToServer(targetID, whatToSend, typeString){
	socket.send(JSON.stringify({
		data:whatToSend,
		type:typeString,
		to:targetID,
		from:MY_WS_ID,
	}))
}


pc.onaddstream = (e)=>{
	/**
	 * For some weird reason, the WebAudio API is not able to correctly use the MediaStreamDestination that is sent
	 * over WebRTC peer connections. It can make them and send them but when you connect things to them all you hear
	 * is perfect silence.  
	 * 
	 * The solution is to create an Audo tag element and add the stream to it using the srcObject and if you then
	 * play it, you can hear the audio sent over the RTC stream.
	 * 
	 * This limitation does not seem to apply to the built-in microphone MediaStream
	 * 
	 * Another limitation is that the audio quality is reduced, but this may just be how the WebRTC rolls. 
	 * 
	 * Maybe in the future things will be nicer.
	 * 
	 * Something else that has yet to be tried is to then transform the audio tag into a WebAudio Source
	 * so that it can be connected to other nodes. This is a stupid route, but it could work, however it is likely
	 * that the audio quality will remain the same.
	 */
	console.log("Added a stream:", e)
	var a = new Audio()
	a.srcObject = e.stream
	a.play()
}
pc.onremovestream = (e)=>{
	console.log("Removed a stream:", e)
}
pc.ondatachannel = (e)=>{
	console.log("dataChannel:", e)
}
pc.onicecandidate = (e)=>{
	if(e.candidate){
		sendToServer(REMOTE_ID, e.candidate.toJSON(), "ice-candidate")
	}
}
pc.onnegotiationneeded = (e)=>{
	// console.log("Need Negotiations!", e)
}
pc.oniceconnectionstatechange = (e)=>{
	console.log("Ice Connection State Change:", pc.iceConnectionState)
}
pc.onsignalingstatechange = (e)=>{
	console.log("Signal State Change:", pc.signalingState)
}

function setMode(newMode){
	MODE = newMode
}

function launchBroadcastServer(){
	setMode("local")
	ipcRenderer.send("poke-server")
	pc.addStream(transDest.stream) // since we are going to broadcast, we add the broadcast stream.
}

function connectToRemoteServer(url){
	setMode("remote")
	connectToServer(url)
}

function getLocalLibrary(){
	ipcRenderer.send("get-local-library")
}

function downloadAndDecodeToBuffer(url){
	return new Promise((resolve, reject)=>{
		var request = new XMLHttpRequest()
		request.open("GET", url, true)
		request.responseType = "arraybuffer"
		request.onload = ()=>{
			resolve(actx.decodeAudioData(request.response))
		}
		request.send()
	})
}

function playSong(id, whatToPlayOn){
	if(libraryMap.has(id)){
		item = libraryMap.get(id)
		var source = actx.createBufferSource()
		source.buffer = item.buffer
		if(whatToPlayOn){
			source.connect(whatToPlayOn)
		}else{
			source.connect(actx.destination)
		}
		source.start(0)
		console.log("Now playing:", item.metadata.title, "by", item.metadata.artist[0])
	}
}

function logLibrary(){
	libraryMap.forEach((value, key)=>{
		console.log(key, " --- " ,value.metadata.title)
	})
}