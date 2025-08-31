// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  sendNotification: (title, body) =>
    ipcRenderer.send("send-notification", { title, body }),

  // Новые методы для уведомлений о звонках
  sendCallNotification: (callData) =>
    ipcRenderer.send("call-notification", callData),

  sendCallEnded: (callData) => ipcRenderer.send("call-ended", callData),

  // можно добавить другие методы, если нужно
});

//npm run build
