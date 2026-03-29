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

  // Backup & Restore (app state)
  backupSelectDestFile: () => ipcRenderer.invoke('backup:selectDestFile'),
  backupSelectFile:     () => ipcRenderer.invoke('backup:selectFile'),
  backupCreate:  (password, destPath) => ipcRenderer.invoke('backup:create',       { password, destPath }),
  backupRestore: (password, filePath) => ipcRenderer.invoke('backup:restore',      { password, filePath }),
  backupReadManifest: (filePath, password) => ipcRenderer.invoke('backup:readManifest', { filePath, password }),

  // File / Folder / Drive Backup
  fileBkpSelectSources:     ()                          => ipcRenderer.invoke('filebkp:selectSources'),
  fileBkpSelectDest:        ()                          => ipcRenderer.invoke('filebkp:selectDest'),
  fileBkpSelectFile:        ()                          => ipcRenderer.invoke('filebkp:selectFile'),
  fileBkpSelectRestoreDest: ()                          => ipcRenderer.invoke('filebkp:selectRestoreDest'),
  fileBkpScan:              (sourcePaths)               => ipcRenderer.invoke('filebkp:scan',         sourcePaths),
  fileBkpCreate:            (password, sourcePaths, destPath) => ipcRenderer.invoke('filebkp:create', { password, sourcePaths, destPath }),
  fileBkpReadManifest:      (filePath, password)        => ipcRenderer.invoke('filebkp:readManifest', { filePath, password }),
  fileBkpRestore:           (password, filePath, destPath) => ipcRenderer.invoke('filebkp:restore',   { password, filePath, destPath }),
  fileBkpCancel:            ()                          => ipcRenderer.send('filebkp:cancel'),
  onFileBkpProgress: (callback) => {
    const handler = (_, prog) => callback(prog)
    ipcRenderer.on('filebkp:progress', handler)
    return () => ipcRenderer.removeListener('filebkp:progress', handler)
  },

  // Scheduled Auto-Backup
  autoBkpGetConfig:       ()          => ipcRenderer.invoke('autobkp:getConfig'),
  autoBkpSetConfig:       (config)    => ipcRenderer.invoke('autobkp:setConfig',    config),
  autoBkpSavePassword:    (pw)        => ipcRenderer.invoke('autobkp:savePassword', pw),
  autoBkpDeletePassword:  ()          => ipcRenderer.invoke('autobkp:deletePassword'),
  autoBkpSelectSources:   ()          => ipcRenderer.invoke('autobkp:selectSources'),
  autoBkpSelectDestFolder: ()         => ipcRenderer.invoke('autobkp:selectDestFolder'),
  autoBkpRunNow:          ()          => ipcRenderer.invoke('autobkp:runNow'),
  onAutoBkpProgress: (callback) => {
    const handler = (_, prog) => callback(prog)
    ipcRenderer.on('autobkp:progress', handler)
    return () => ipcRenderer.removeListener('autobkp:progress', handler)
  },
  onAutoBkpStatus: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('autobkp:status', handler)
    return () => ipcRenderer.removeListener('autobkp:status', handler)
  },

  // Backup History
  historySelectFolder: ()      => ipcRenderer.invoke('history:selectFolder'),
  historyScan:         (fp)    => ipcRenderer.invoke('history:scan',   fp),
  historyDelete:       (path)  => ipcRenderer.invoke('history:delete', path),
})
