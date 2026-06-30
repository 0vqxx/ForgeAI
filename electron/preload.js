const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("bloom", {
  version: () => ipcRenderer.invoke("app:version"),
  onMenu: (cb) => ipcRenderer.on("menu", (_evt, action) => cb(action)),
});
