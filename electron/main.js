import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createRequire } from 'module'
import fs from 'fs'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const { scanFolder, moveFiles, undoOperation, loadHistory, ensureAppDataDir, deleteEmptyFolders } = require('./fileSystem.cjs')

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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ── Helper: send structured logs to renderer console bar ──────
function sendLog(message, type = 'info', source = 'Electron') {
  mainWindow?.webContents?.send('main:log', { message, type, source })
}

app.on('window-all-closed', () => {
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
