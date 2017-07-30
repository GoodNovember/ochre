const WebSocket = require("ws")
const uuid = require("uuid")
const connectionMap = new Map()

const DEFAULT_PORT = 8080

const {ipcMain} = require('electron')

let MASTER_ID = null

function heartbeat(){
	this.isAlive = true
}

function createServer(providedPort){

	let usedPort = providedPort || DEFAULT_PORT

	const wss = new WebSocket.Server({port:usedPort})

	wss.on("connection", (ws, req) => {

		// This is area is relevent to the beginning of a new connection.
		// We must name the connection and send that name back to the client
		// connecting so that it knows its own name. Very parental. 

		const ConnectionID = uuid()
		const IP = req.connection.remoteAddress;

		ws.on("message", (msg)=>{
			var message = JSON.parse(msg)
			console.log(message)
			if(message.type === "my-mode"){
				if(message.data === "remote"){
					console.log("Can send an offer!")
					send(message.from, "make-offer", message.from, MASTER_ID)
				}else if (message.data === "local"){
					console.log("Is my local machine!")
					if(!MASTER_ID){
						MASTER_ID = ConnectionID
						console.log("MASTER ID SET.")
					}
				}
			}else{
				send(message.data, message.type, message.from, message.to)
			}
		})

		// send our new connection its name

		let signiture = {
			type:"identity",
			data:ConnectionID,
			from:'server',
			to:ConnectionID,
		}

		connectionMap.set(ConnectionID, ws) // add the connection to the map

		ws.send(JSON.stringify(signiture))

		// console.log("WS:", ws)

		// this deals with detecting whether a connection is still alive
		ws.on("pong",heartbeat)
		ws.isAlive = true // when we first connect, we breathe life into our client

	})

	function send(data, type, from, to){
		if(connectionMap.has(to)){
			var targetWS = connectionMap.get(to)
			if(targetWS.isAlive){
				targetWS.send(JSON.stringify({
					to,
					from,
					data,
					type,
				}))
			}else{
				connectionMap.delete(to)
				console.log("The destination was found to be dead and was removed from the connections list.")
			}
		}else{
			console.log("The destination was not found to be in the connections list.")
		}
	}

	// every 30 seconds. we check to see if a connection is still alive.
	// if we find that it is dead, we terminate it.
	setInterval(()=>{
		wss.clients.forEach((ws)=>{
			if(ws.isAlive === false){
				ws.terminate() 
			}else{
				ws.isAlive = false
				ws.ping("", false, true)
			}
		})
	}, 30000)

	return {
		wss,
		url:`ws://localhost:${usedPort}`
	}

}

module.exports = {
	create:createServer,
	
}