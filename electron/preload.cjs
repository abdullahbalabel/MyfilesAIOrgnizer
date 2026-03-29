const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Folder dialog
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // File system
  scanFolder: (folderPath, recursive) =>
    ipcRenderer.invoke('fs:scanFolder', folderPath, recursive),
  executeOrganize: (plan, targetRoot) =>
    ipcRenderer.invoke('fs:executeOrganize', plan, targetRoot),
  undo: (operationId) => ipcRenderer.invoke('fs:undo', operationId),
  loadHistory: () => ipcRenderer.invoke('fs:loadHistory'),

  // Shell
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),

  // Settings
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (data) => ipcRenderer.invoke('settings:save', data),

  // Gemini AI — one batch at a time (renderer controls the loop)
  testApiKey: (apiKey) => ipcRenderer.invoke('gemini:testKey', apiKey),
  classifyBatch: (batch, batchNum, totalBatches, apiKey, customRules) =>
    ipcRenderer.invoke('gemini:classifyBatch', batch, batchNum, totalBatches, apiKey, customRules),

  // Destination folder dialog
  selectDestFolder: () => ipcRenderer.invoke('dialog:selectDestFolder'),

  // Delete empty folders
  deleteEmptyFolders: (folderPath) => ipcRenderer.invoke('fs:deleteEmptyFolders', folderPath),

  // Receive log messages from main process
  onMainLog: (callback) => {
    const handler = (event, msg) => callback(event, msg)
    ipcRenderer.on('main:log', handler)
    return () => ipcRenderer.removeListener('main:log', handler)
  },
})
