const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')
const url = require('url')
const oWSS = require("./ochreWSS.js")

const oLibrary = require("./ochreMusicLibrary")

let activeServer = null
let ochreWSSData = null

ipcMain.on('asynchronous-message', (event, arg) => {
  console.log(arg)  // prints "ping"
  event.sender.send('asynchronous-reply', 'pong')
})

ipcMain.on('synchronous-message', (event, arg) => {
  console.log(arg)  // prints "ping"
  event.returnValue = 'pong'
})

ipcMain.on('get-local-library', (event, arg)=>{
  oLibrary.getLibraryData().then((library)=>{
    event.sender.send("local-library", library)
  })
})

ipcMain.on('get-remote-library', (event, erg)=>{

})

ipcMain.on("poke-server", (event, arg) =>{
  if(!activeServer){
    ochreWSSData = oWSS.create()
    activeServer = ochreWSSData.wss
    event.sender.send("server-is-created", true)
  }
  setTimeout(function() {
    event.sender.send("server-is-alive", ochreWSSData.url)
  }, 500);
})
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({width: 800, height: 600})

  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'ui/index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.