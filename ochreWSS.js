const WebSocket = require("ws")
const uuid = require("uuid")
const connectionMap = new Map()

const DEFAULT_PORT = 8080

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
				}else if (message.data === "local"){
					console.log("Is my local machine!")
				}
			}
		})

		// send our new connection its name

		let signiture = {
			type:"identity",
			id:ConnectionID,
		}

		ws.send(JSON.stringify(signiture))

		// console.log("WS:", ws)

		// this deals with detecting whether a connection is still alive
		ws.on("pong",heartbeat)
		ws.isAlive = true // when we first connect, we breathe life into our client

	})

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