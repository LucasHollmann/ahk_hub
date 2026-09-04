const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  startCapturePosition: () => ipcRenderer.send("capture-position:start"),
  cancelCapturePosition: () => ipcRenderer.send("capture-position:cancel"),
  onPositionCaptured: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("capture-position:result", listener);
    return () => ipcRenderer.removeListener("capture-position:result", listener);
  },
});
