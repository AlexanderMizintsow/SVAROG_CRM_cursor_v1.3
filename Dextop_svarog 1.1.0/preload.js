// preload.js
const { contextBridge, ipcRenderer } = require("electron");

console.log("=== PRELOAD.JS ЗАГРУЖЕН ===");

contextBridge.exposeInMainWorld("electronAPI", {
  sendNotification: (title, body) => {
    console.log("preload: sendNotification вызван", title, body);
    ipcRenderer.send("send-notification", { title, body });
    console.log("preload: ipcRenderer.send выполнен");
  },

  // Новые методы для уведомлений о звонках
  sendCallNotification: (callData) => {
    console.log("preload: sendCallNotification вызван", callData);
    ipcRenderer.send("call-notification", callData);
  },

  sendCallEnded: (callData) => {
    console.log("preload: sendCallEnded вызван", callData);
    ipcRenderer.send("call-ended", callData);
  },
});

//npm run build
