const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  setFullScreen: (flag) => ipcRenderer.invoke("set-fullscreen", flag),
  confirmSubmit: () => ipcRenderer.invoke("confirm-submit"),
});
