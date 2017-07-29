let MODE = "local"
let WS_ID = null
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
const transportableDestination = actx.createMediaStreamDestination()
const pc = new RTCPeerConnection()
pc.addStream(transportableDestination.stream)

function connectToServer(url){
	socket = new WebSocket(url)

	socket.onmessage = (event)=>{
		var data = JSON.parse(event.data)
		console.log("[client] got message:", data)

		if(data.type === "identity"){ // get a name from the server.
			WS_ID = data.id
			console.log("[client] my name is:", WS_ID)
			sendToServer(null, MODE, "my-mode")
		}
		if(data.from && data.from !== WS_ID){
			REMOTE_ID = data.from
		}
		if(data.type === "ice-candidate"){
			var candidate = new RTCIceCandidate(data.data)
			pc.addIceCandidate(candidate)
		}
		if(data.type === "offer"){
			var description = new RTCSessionDescription(data.data)
			pc.setRemoteDescription(description).then(()=>{
				pc.createAnswer().then((answer)=>{
					pc.setLocalDescription(answer).then(()=>{
						sendToServer(REMOTE_ID, answer.toJSON, "answer")
					})
				})
			})
		}
		if(data.type === "answer"){
			var description = new RTCSessionDescription(data.data)
			pc.setRemoteDescription(description)
		}
	}

}

function sendToServer(target, whatToSend, type){
	let playload = {
		data:whatToSend,
		type:type,
		to:target,
		from:WS_ID,
	}
	var str = JSON.stringify(playload)
	socket.send(str)
}


pc.onaddstream = (e)=>{
	console.log("Added a stream:", e)
	var stream = actx.createMediaStreamSource(e.stream)
	if(stream){
		stream.connect(actx.destination)
		console.log("Connected that stream to the speakers.")
	}
}
pc.onremovestream = (e)=>{
	console.log("Removed a stream:", e)
}
pc.ondatachannel = (e)=>{
	console.log("dataChannel:", e)
}
pc.onicecandidate = (e)=>{
	console.log("iceCandidate:", e)
	sendToServer(REMOTE_ID, e.candidate, "ice-candidate")
}
pc.onnegotiationneeded = (e)=>{
	console.log("Need Negotiations!", e)
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
	ipcRenderer.send("poke-server")
}

function connectToRemoteServer(url){
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