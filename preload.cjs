// Preload script - expose safe APIs to renderer
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Example: expose safe methods
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});