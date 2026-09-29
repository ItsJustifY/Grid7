const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  fetchServers: () => ipcRenderer.invoke('servers:fetch'),
  connect: (id) => ipcRenderer.invoke('servers:connect', id),
});
