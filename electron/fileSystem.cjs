const fs = require('fs')
const path = require('path')
const os = require('os')

const APP_DATA_DIR = path.join(os.homedir(), '.myfiles-ai-organizer')
const HISTORY_FILE = path.join(APP_DATA_DIR, 'history.json')

function ensureAppDataDir() {
  if (!fs.existsSync(APP_DATA_DIR)) {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true })
  }
}

// File extension → category mapping
const EXT_MAP = {
  // Documents
  pdf: 'Documents', doc: 'Documents', docx: 'Documents', txt: 'Documents',
  odt: 'Documents', rtf: 'Documents', pages: 'Documents', md: 'Documents',
  // Spreadsheets
  xls: 'Spreadsheets', xlsx: 'Spreadsheets', csv: 'Spreadsheets',
  ods: 'Spreadsheets', numbers: 'Spreadsheets',
  // Presentations
  ppt: 'Presentations', pptx: 'Presentations', odp: 'Presentations', key: 'Presentations',
  // Images
  jpg: 'Images', jpeg: 'Images', png: 'Images', gif: 'Images', bmp: 'Images',
  svg: 'Images', webp: 'Images', ico: 'Images', tiff: 'Images', heic: 'Images',
  // Videos
  mp4: 'Videos', avi: 'Videos', mkv: 'Videos', mov: 'Videos', wmv: 'Videos',
  flv: 'Videos', webm: 'Videos', m4v: 'Videos',
  // Audio
  mp3: 'Audio', wav: 'Audio', flac: 'Audio', aac: 'Audio', ogg: 'Audio',
  m4a: 'Audio', wma: 'Audio',
  // Archives
  zip: 'Archives', rar: 'Archives', '7z': 'Archives', tar: 'Archives',
  gz: 'Archives', bz2: 'Archives',
  // Code
  js: 'Code', ts: 'Code', jsx: 'Code', tsx: 'Code', py: 'Code', java: 'Code',
  cpp: 'Code', c: 'Code', cs: 'Code', go: 'Code', rs: 'Code', php: 'Code',
  rb: 'Code', swift: 'Code', kt: 'Code', html: 'Code', css: 'Code', json: 'Code',
  xml: 'Code', yaml: 'Code', yml: 'Code', sh: 'Code', bat: 'Code',
  // Design
  psd: 'Design', ai: 'Design', xd: 'Design', fig: 'Design', sketch: 'Design',
  indd: 'Design',
  // Executables
  exe: 'Applications', msi: 'Applications', dmg: 'Applications', app: 'Applications',
  deb: 'Applications', rpm: 'Applications',
}

function getCategory(ext) {
  return EXT_MAP[ext.toLowerCase()] || 'Other'
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function scanFolder(folderPath, recursive = true, depth = 0, rootPath = null) {
  const MAX_DEPTH = recursive ? 5 : 0
  const entries = []
  if (!rootPath) rootPath = folderPath  // remember the root for relative path computation

  if (depth > MAX_DEPTH) return entries

  let items
  try {
    items = fs.readdirSync(folderPath)
  } catch (e) {
    return entries
  }

  for (const item of items) {
    if (item.startsWith('.') || item === 'node_modules' || item === '$RECYCLE.BIN') continue

    const fullPath = path.join(folderPath, item)

    let stat
    try {
      stat = fs.statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      if (depth < MAX_DEPTH && recursive) {
        const children = await scanFolder(fullPath, recursive, depth + 1, rootPath)
        entries.push(...children)
      }
    } else {
      const ext = path.extname(item).replace('.', '').toLowerCase()
      // relativePath shows the subfolder context (e.g. "THIQAH/Reports/file.pdf")
      const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/')
      entries.push({
        id: Buffer.from(fullPath).toString('base64').slice(0, 16) + Date.now(),
        name: item,
        path: fullPath,
        relativePath,
        ext,
        category: getCategory(ext),
        size: stat.size,
        sizeFormatted: formatSize(stat.size),
        modified: stat.mtime.toISOString(),
        created: stat.birthtime.toISOString(),
      })
    }
  }

  return entries
}


async function moveFiles(plan, targetRoot) {
  const operations = []
  const timestamp = Date.now()
  const operationId = `op_${timestamp}`

  // Ensure target root exists
  if (!fs.existsSync(targetRoot)) {
    fs.mkdirSync(targetRoot, { recursive: true })
  }

  for (const item of plan) {
    const srcPath = item.originalPath
    const destDir = path.join(targetRoot, item.suggestedFolder)
    const destPath = path.join(destDir, path.basename(srcPath))

    if (!fs.existsSync(srcPath)) continue

    // Create destination directory
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    // Handle name conflicts
    let finalDest = destPath
    if (fs.existsSync(finalDest)) {
      const base = path.basename(srcPath, path.extname(srcPath))
      const ext = path.extname(srcPath)
      finalDest = path.join(destDir, `${base}_${timestamp}${ext}`)
    }

    fs.renameSync(srcPath, finalDest)
    operations.push({ from: srcPath, to: finalDest })
  }

  // Save to history
  const history = loadHistory()
  history.unshift({
    id: operationId,
    timestamp,
    date: new Date().toISOString(),
    operations,
    count: operations.length,
    folderName: path.basename(targetRoot),
  })
  // Keep last 20 operations
  if (history.length > 20) history.splice(20)
  saveHistory(history)

  return { operationId, count: operations.length }
}

function undoOperation(operationId) {
  const history = loadHistory()
  const op = history.find((h) => h.id === operationId)
  if (!op) throw new Error('Operation not found in history')

  for (const { from, to } of op.operations.reverse()) {
    if (!fs.existsSync(to)) continue
    const destDir = path.dirname(from)
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }
    fs.renameSync(to, from)
  }

  // Remove from history
  const newHistory = history.filter((h) => h.id !== operationId)
  saveHistory(newHistory)
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
    }
  } catch {}
  return []
}

function saveHistory(history) {
  ensureAppDataDir()
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

module.exports = { scanFolder, moveFiles, undoOperation, loadHistory, saveHistory, ensureAppDataDir, deleteEmptyFolders }

// ─── Delete empty folders recursively ──────────────────
function deleteEmptyFolders(folderPath, skipRoot = true) {
  if (!fs.existsSync(folderPath)) return { deleted: 0 }
  let deleted = 0

  const stat = fs.statSync(folderPath)
  if (!stat.isDirectory()) return { deleted: 0 }

  // Process subdirectories first (depth-first)
  const entries = fs.readdirSync(folderPath)
  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry)
    try {
      if (fs.statSync(fullPath).isDirectory()) {
        const result = deleteEmptyFolders(fullPath, false)
        deleted += result.deleted
      }
    } catch {}
  }

  // After processing children, check if this dir is now empty
  if (!skipRoot) {
    try {
      const remaining = fs.readdirSync(folderPath)
      if (remaining.length === 0) {
        fs.rmdirSync(folderPath)
        deleted++
      }
    } catch {}
  }

  return { deleted }
}
