const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  platform: process.platform,
  startCapturePosition: (options) => ipcRenderer.send("capture-position:start", options),
  cancelCapturePosition: () => ipcRenderer.send("capture-position:cancel"),
  onPositionCaptured: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("capture-position:result", listener);
    return () => ipcRenderer.removeListener("capture-position:result", listener);
  },
  saveScript: (content, path) => ipcRenderer.invoke("save-script", content, path),
  runScript: (path) => ipcRenderer.invoke("run-script", path),
  loadScript: () => ipcRenderer.invoke("load-script"),
  startRecording: () => ipcRenderer.send("record:start"),
  stopRecording: () => ipcRenderer.send("record:stop"),
  onRecordedEvent: (callback) => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("record:event", listener);
    return () => ipcRenderer.removeListener("record:event", listener);
  },
});
