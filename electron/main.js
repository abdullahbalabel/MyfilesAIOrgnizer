import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'
import fs from 'fs'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const { scanFolder, moveFiles, undoOperation, loadHistory, ensureAppDataDir, deleteEmptyFolders } = require('./fileSystem.cjs')
const { createBackup, readManifest, restoreBackup } = require('./backup.cjs')
const { createFileBackup, readFileBackupManifest, restoreFileBackup, CancelToken, scanSources } = require('./fileBackup.cjs')
const {
  initAutoBackup, stopScheduler,
  loadConfig: loadAutoConfig, saveConfig: saveAutoConfig,
  runAutoBackup, savePassword, hasPassword, deletePassword, isEncryptionAvailable,
} = require('./autoBackup.cjs')

let activeCancelToken = null  // tracks a running file backup so it can be cancelled

const isDev = process.env.NODE_ENV === 'development'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f0f1a',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ensureAppDataDir()
  createWindow()
  initAutoBackup(mainWindow)   // ← start the 60-second auto-backup scheduler
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ── Helper: send structured logs to renderer console bar ──────
function sendLog(message, type = 'info', source = 'Electron') {
  mainWindow?.webContents?.send('main:log', { message, type, source })
}

app.on('window-all-closed', () => {
  stopScheduler()
  if (process.platform !== 'darwin') app.quit()
})

// ── Window controls ───────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())

// ── Dialogs ───────────────────────────────────────────────────
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Folder to Organize',
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:selectDestFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Destination Folder for Organized Files',
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── File System ───────────────────────────────────────────────
ipcMain.handle('fs:scanFolder', async (_, folderPath, recursive) => {
  try {
    sendLog(`Scanning: ${folderPath} (recursive=${recursive})`, 'info', 'FileSystem')
    const data = await scanFolder(folderPath, recursive)
    sendLog(`Scan complete: ${data.length} files found`, 'success', 'FileSystem')
    return { success: true, data }
  } catch (err) {
    sendLog(`Scan error: ${err.message}`, 'error', 'FileSystem')
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:executeOrganize', async (_, plan, targetRoot) => {
  try {
    sendLog(`Executing plan: moving ${plan.length} files → ${targetRoot}`, 'info', 'FileSystem')
    const result = await moveFiles(plan, targetRoot)
    sendLog(`Execution complete: ${result.count} files moved`, 'success', 'FileSystem')
    return { success: true, data: result }
  } catch (err) {
    sendLog(`Execution error: ${err.message}`, 'error', 'FileSystem')
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:undo', async (_, operationId) => {
  try {
    sendLog(`Undoing operation: ${operationId}`, 'warn', 'FileSystem')
    await undoOperation(operationId)
    sendLog(`Undo complete`, 'success', 'FileSystem')
    return { success: true }
  } catch (err) {
    sendLog(`Undo error: ${err.message}`, 'error', 'FileSystem')
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:loadHistory', async () => {
  return loadHistory()
})

ipcMain.handle('fs:deleteEmptyFolders', async (_, folderPath) => {
  try {
    sendLog(`Deleting empty folders in: ${folderPath}`, 'info', 'FileSystem')
    const result = deleteEmptyFolders(folderPath)
    sendLog(`Deleted ${result.deleted} empty folder(s)`, result.deleted > 0 ? 'success' : 'info', 'FileSystem')
    return { success: true, deleted: result.deleted }
  } catch (err) {
    sendLog(`Delete empty folders error: ${err.message}`, 'error', 'FileSystem')
    return { success: false, error: err.message }
  }
})

ipcMain.handle('shell:openPath', async (_, filePath) => {
  shell.showItemInFolder(filePath)
})

// ── Settings ──────────────────────────────────────────────────
const settingsPath = join(app.getPath('userData'), 'organizer-settings.json')

ipcMain.handle('settings:load', () => {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    }
    return {}
  } catch {
    return {}
  }
})

ipcMain.handle('settings:save', (_, data) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2))
    return true
  } catch {
    return false
  }
})

// ── Backup & Restore ──────────────────────────────────────────
ipcMain.handle('backup:selectDestFile', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Encrypted Backup',
    defaultPath: `myfiles-backup-${new Date().toISOString().slice(0,10)}.mfab`,
    filters: [{ name: 'MyFiles Backup', extensions: ['mfab'] }],
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('backup:selectFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Encrypted Backup',
    filters: [{ name: 'MyFiles Backup', extensions: ['mfab'] }],
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('backup:create', async (_, { password, destPath }) => {
  try {
    sendLog('Creating encrypted backup…', 'info', 'Backup')
    const { manifest } = await createBackup(password, destPath, settingsPath)
    sendLog(`Backup created: ${destPath}`, 'success', 'Backup')
    return { success: true, manifest }
  } catch (err) {
    sendLog(`Backup error: ${err.message}`, 'error', 'Backup')
    return { success: false, error: err.message }
  }
})

ipcMain.handle('backup:readManifest', async (_, { filePath, password }) => {
  try {
    const { manifest } = await readManifest(password, filePath)
    return { success: true, manifest }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('backup:restore', async (_, { password, filePath }) => {
  try {
    sendLog('Restoring backup…', 'warn', 'Backup')
    const { manifest } = await restoreBackup(password, filePath, settingsPath)
    sendLog('Backup restored successfully', 'success', 'Backup')
    return { success: true, manifest }
  } catch (err) {
    sendLog(`Restore error: ${err.message}`, 'error', 'Backup')
    return { success: false, error: err.message }
  }
})

// ── File / Folder / Drive Backup ──────────────────────────────
ipcMain.handle('filebkp:selectSources', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Folders / Drives to Back Up',
    properties: ['openDirectory', 'multiSelections'],
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('filebkp:selectDest', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Encrypted Backup',
    defaultPath: `myfiles-backup-${new Date().toISOString().slice(0, 10)}.mfab`,
    filters: [{ name: 'MyFiles Backup', extensions: ['mfab'] }],
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('filebkp:selectFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Encrypted Backup',
    filters: [{ name: 'MyFiles Backup', extensions: ['mfab'] }],
    properties: ['openFile'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('filebkp:selectRestoreDest', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Restore Destination Folder',
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('filebkp:scan', async (_, sourcePaths) => {
  try {
    const info = await scanSources(sourcePaths)
    return { success: true, ...info }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('filebkp:create', async (_, { password, sourcePaths, destPath }) => {
  try {
    if (activeCancelToken) activeCancelToken.cancel()
    activeCancelToken = new CancelToken()
    const token = activeCancelToken

    sendLog(`Starting file backup: ${sourcePaths.length} source(s) → ${destPath}`, 'info', 'FileBackup')

    const { manifest } = await createFileBackup({
      password,
      sourcePaths,
      destPath,
      cancelToken: token,
      onProgress: (prog) => {
        mainWindow?.webContents?.send('filebkp:progress', prog)
      },
    })

    activeCancelToken = null
    sendLog(`File backup complete: ${manifest.totalFiles} files`, 'success', 'FileBackup')
    return { success: true, manifest }
  } catch (err) {
    activeCancelToken = null
    const cancelled = err.message === 'Backup cancelled by user'
    sendLog(cancelled ? 'Backup cancelled' : `File backup error: ${err.message}`, cancelled ? 'warn' : 'error', 'FileBackup')
    return { success: false, error: err.message, cancelled }
  }
})

ipcMain.handle('filebkp:readManifest', async (_, { filePath, password }) => {
  try {
    const { manifest } = await readFileBackupManifest(password, filePath)
    return { success: true, manifest }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('filebkp:restore', async (_, { password, filePath, destPath }) => {
  try {
    sendLog(`Restoring file backup to: ${destPath}`, 'warn', 'FileBackup')
    const { manifest, extracted } = await restoreFileBackup({
      password,
      filePath,
      destPath,
      onProgress: (prog) => {
        mainWindow?.webContents?.send('filebkp:progress', prog)
      },
    })
    sendLog(`Restore complete: ${extracted} files extracted`, 'success', 'FileBackup')
    return { success: true, manifest, extracted }
  } catch (err) {
    sendLog(`Restore error: ${err.message}`, 'error', 'FileBackup')
    return { success: false, error: err.message }
  }
})

ipcMain.on('filebkp:cancel', () => {
  if (activeCancelToken) {
    activeCancelToken.cancel()
    sendLog('Backup cancellation requested', 'warn', 'FileBackup')
  }
})

// ── Scheduled Auto-Backup ──────────────────────────────────────
ipcMain.handle('autobkp:getConfig', async () => {
  const config = loadAutoConfig()
  return {
    config,
    encryptionAvailable: isEncryptionAvailable(),
    hasPassword: hasPassword(),
  }
})

ipcMain.handle('autobkp:setConfig', async (_, newConfig) => {
  saveAutoConfig(newConfig)
  return { success: true, config: newConfig }
})

ipcMain.handle('autobkp:savePassword', async (_, password) => {
  try {
    if (!password) { deletePassword(); return { success: true } }
    savePassword(password)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('autobkp:deletePassword', async () => {
  try { deletePassword(); return { success: true } } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('autobkp:selectSources', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Folders to Auto-Back Up',
    properties: ['openDirectory', 'multiSelections'],
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('autobkp:selectDestFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Auto-Backup Destination Folder',
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('autobkp:runNow', async () => {
  const config = loadAutoConfig()
  if (!config.sourcePaths?.length || !config.destFolder) {
    return { success: false, error: 'Configure sources and destination first' }
  }
  sendLog('Manual auto-backup triggered', 'info', 'AutoBackup')
  const result = await runAutoBackup(config)
  if (result.success) sendLog('Auto-backup complete: ' + result.config.lastFile, 'success', 'AutoBackup')
  else sendLog(`Auto-backup failed: ${result.error}`, 'error', 'AutoBackup')
  return result
})

// ── Backup History ─────────────────────────────────────────────
ipcMain.handle('history:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Backup History Folder',
    properties: ['openDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('history:scan', async (_, folderPath) => {
  try {
    const entries = fs.readdirSync(folderPath)
    const files = []
    for (const name of entries) {
      const lower = name.toLowerCase()
      if (!lower.endsWith('.mfab') && !lower.endsWith('.zip')) continue
      const full = join(folderPath, name)
      let stat
      try { stat = fs.statSync(full) } catch { continue }
      if (!stat.isFile()) continue

      const isEncrypted = lower.endsWith('.mfab')
      let valid = !isEncrypted   // zips are assumed valid; mfab checked below

      if (isEncrypted) {
        try {
          // Read only the 256-byte plain header (no password needed)
          const buf = Buffer.alloc(256)
          const fd  = fs.openSync(full, 'r')
          fs.readSync(fd, buf, 0, 256, 0)
          fs.closeSync(fd)
          const hdr = JSON.parse(buf.toString('utf8').replace(/\0+$/, ''))
          valid = hdr.magic === 'MFAB2'
        } catch { valid = false }
      }

      files.push({ name, path: full, size: stat.size, mtime: stat.mtime.toISOString(), type: isEncrypted ? 'mfab' : 'zip', isEncrypted, valid })
    }
    files.sort((a, b) => new Date(b.mtime) - new Date(a.mtime))
    return { success: true, files }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('history:delete', async (_, filePath) => {
  try { fs.unlinkSync(filePath); return { success: true } }
  catch (err) { return { success: false, error: err.message } }
})

// ── Gemini AI — single batch per IPC call ─────────────────────
// The renderer loops through batches so the main process never blocks

ipcMain.handle('gemini:testKey', async (_, apiKey) => {
  try {
    sendLog('Testing Gemini API key…', 'ai', 'Gemini')
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })
    const result = await model.generateContent('Say hello')
    const text = result.response.text()
    const valid = typeof text === 'string' && text.length > 0
    sendLog(valid ? 'API key is valid ✅' : 'API key invalid ❌', valid ? 'success' : 'error', 'Gemini')
    return { success: true, valid }
  } catch (err) {
    sendLog(`API key test error: ${err?.message}`, 'error', 'Gemini')
    return { success: false, valid: false, error: err?.message }
  }
})

ipcMain.handle('gemini:classifyBatch', async (_, batch, batchNum, totalBatches, apiKey, customRules) => {
  // Inner function so we can retry cleanly
  const attempt = async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    const fileList = batch.map((f, idx) => ({
      idx,
      name: f.name,
      // relativePath reveals the original subfolder structure (e.g. "THIQAH/Reports/invoice.pdf")
      // This tells the AI which project/context the file came from
      relativePath: f.relativePath || f.name,
      ext: f.ext,
      size: f.sizeFormatted,
      modified: f.modified?.split('T')[0],
      category: f.category,
    }))

    const prompt = `You are a file organizer AI. Sort files into a SMALL, CONSISTENT folder structure.

STRICT RULES:
1. Use ONLY these top-level folders (no others):
   Documents, Spreadsheets, Presentations, Images, Videos, Audio, Archives, Code, Design, Applications, Other

2. You MAY add ONE sub-level to group related files when it makes sense.
   - Use the file's "relativePath" to detect which project/context it belongs to.
   - Example: if relativePath is "THIQAH/Reports/invoice.pdf" → suggestedFolder: "Documents/THIQAH"
   - Example: if relativePath is "Screenshots/2024/img.png" → suggestedFolder: "Images/Screenshots"

3. Keep sub-folder names SHORT and CONSISTENT across all files — the same project must get the same sub-folder name in every batch.

4. Do NOT create date folders (e.g. "2024/Documents"). Use the category instead.
${customRules ? `\nUSER OVERRIDES (highest priority):\n${customRules}` : ''}

Files to classify:
${JSON.stringify(fileList, null, 2)}

Return ONLY a valid JSON array — no markdown, no explanation:
[{"idx":0,"suggestedFolder":"Documents/THIQAH","category":"Documents","confidence":0.95,"reason":"Invoice from THIQAH project folder"}]`

    // 90-second timeout — generous enough for slow API responses
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after 90s`)), 90000)
    )

    const resp = await Promise.race([model.generateContent(prompt), timeoutPromise])
    const text = resp.response.text().trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return batch.map((file, localIdx) => {
      const ai = parsed.find((r) => r.idx === localIdx)
      return {
        ...file,
        suggestedFolder: ai?.suggestedFolder || file.category || 'Other',
        aiCategory: ai?.category || file.category,
        confidence: ai?.confidence || 0.7,
        reason: ai?.reason || 'Classified by extension',
        originalPath: file.path,
      }
    })
  }

  sendLog(`Batch ${batchNum}/${totalBatches}: classifying ${batch.length} files…`, 'ai', 'Gemini')

  // First attempt
  try {
    const result = await attempt()
    sendLog(`Batch ${batchNum}/${totalBatches} done ✓`, 'success', 'Gemini')
    return { success: true, data: result }
  } catch (err) {
    sendLog(`Batch ${batchNum} failed (${err.message}) — retrying in 5s…`, 'warn', 'Gemini')
  }

  // Wait 5s then retry once
  await new Promise((resolve) => setTimeout(resolve, 5000))
  try {
    const result = await attempt()
    sendLog(`Batch ${batchNum}/${totalBatches} recovered on retry ✓`, 'success', 'Gemini')
    return { success: true, data: result }
  } catch (err) {
    sendLog(`Batch ${batchNum} retry failed — using extension fallback`, 'warn', 'Gemini')
    return {
      success: true,
      data: batch.map((file) => ({
        ...file,
        suggestedFolder: file.category || 'Other',
        aiCategory: file.category,
        confidence: 0.5,
        reason: 'Fallback: batch timed out twice',
        originalPath: file.path,
      })),
    }
  }
})
