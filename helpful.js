function toJSON(string){
	return new Promise((resolve, reject)=>{
		try{ 
			resolve(JSON.parse(string))
		}
		catch(e){
			reject(e)
		}
	})
}

function stringify(something){
	return new Promise((resolve, reject)=>{
		try{
			var str = JSON.stringify(something)
			resolve(str)
		}catch(e){
			reject(e)
		}
	})
}

module.exports = {
	toJSON,
	stringify
}