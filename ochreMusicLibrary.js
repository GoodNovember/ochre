const fs = require("fs")
const mm = require('musicmetadata');
const uuid = require("uuid");

const mediaLibraryPath = __dirname + "/media_library"

function getMetadata(filename){
	return new Promise((resove, reject)=>{
		var readStream = fs.createReadStream(filename);
		mm(readStream, (error, metadata)=>{
			if(error){
				reject(error)
			}else{
				resove(metadata)
			}
			readStream.close()
		})
	})
}

function getDirectoryData(dirPath){
	return new Promise((resolve, reject)=>{
		fs.readdir(dirPath, (error, files)=>{
			if(error){
				reject(error)
			}else{
				resolve(files)
			}
		})
	})
}

function getLibraryData(){
	return getDirectoryData(mediaLibraryPath).then((files)=>{
		var promises = files.map((fileStr)=>{
			let filename = mediaLibraryPath + "/" + fileStr
			return getMetadata(filename).then((metadata)=>{
				return {
					metadata,
					path: filename,
					id: uuid()
				}
			})
		})
		return Promise.all(promises)
	})
}

module.exports = { getLibraryData }