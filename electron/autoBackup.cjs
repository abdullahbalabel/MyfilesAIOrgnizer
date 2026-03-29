/**
 * autoBackup.cjs — Scheduled Auto-Backup Engine
 *
 * Runs a background scheduler (60-second tick) that checks whether it's time
 * to create an automatic backup of user-configured source folders.
 *
 * Encryption: optional — if a password is stored via Electron safeStorage,
 *             the backup is an encrypted .mfab (AES-256-CBC + HMAC).
 *             Otherwise it's a plain .zip file.
 *
 * Config persisted in: <appDataDir>/auto-backup.json
 * Password persisted in: <appDataDir>/auto-backup.pw  (OS-encrypted bytes)
 */

'use strict'

const fs       = require('fs')
const path     = require('path')
const os       = require('os')
const archiver = require('archiver')
const { createFileBackup } = require('./fileBackup.cjs')

// ── Paths ────────────────────────────────────────────────────────────────────
const APP_DATA_DIR   = path.join(os.homedir(), '.myfiles-ai-organizer')
const CONFIG_FILE    = path.join(APP_DATA_DIR, 'auto-backup.json')
const PASSWORD_FILE  = path.join(APP_DATA_DIR, 'auto-backup.pw')

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  enabled:     false,
  sourcePaths: [],
  destFolder:  '',
  schedule:    'daily',   // 'hourly' | 'daily' | 'weekly'
  hour:        2,          // hour of day to run (0-23) for daily/weekly
  dayOfWeek:   0,          // 0=Sun … 6=Sat for weekly
  usePassword: false,
  lastRun:     null,       // ISO string
  lastStatus:  null,       // 'success' | 'error'
  lastError:   null,
  lastFile:    null,       // path of last backup file
}

// ── Module-level state ────────────────────────────────────────────────────────
let schedulerTimer  = null
let mainWindowRef   = null

// ─────────────────────────────────────────────────────────────────────────────
// Config helpers
// ─────────────────────────────────────────────────────────────────────────────
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) }
    }
  } catch {}
  return { ...DEFAULT_CONFIG }
}

function saveConfig(config) {
  if (!fs.existsSync(APP_DATA_DIR)) fs.mkdirSync(APP_DATA_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// Password helpers (Electron safeStorage)
// ─────────────────────────────────────────────────────────────────────────────
function isEncryptionAvailable() {
  try {
    const { safeStorage } = require('electron')
    return safeStorage.isEncryptionAvailable()
  } catch { return false }
}

function savePassword(password) {
  const { safeStorage } = require('electron')
  const encrypted = safeStorage.encryptString(password)
  if (!fs.existsSync(APP_DATA_DIR)) fs.mkdirSync(APP_DATA_DIR, { recursive: true })
  fs.writeFileSync(PASSWORD_FILE, encrypted)
}

function loadPassword() {
  if (!fs.existsSync(PASSWORD_FILE)) return null
  try {
    const { safeStorage } = require('electron')
    return safeStorage.decryptString(fs.readFileSync(PASSWORD_FILE))
  } catch { return null }
}

function hasPassword() {
  return fs.existsSync(PASSWORD_FILE)
}

function deletePassword() {
  if (fs.existsSync(PASSWORD_FILE)) fs.unlinkSync(PASSWORD_FILE)
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler logic
// ─────────────────────────────────────────────────────────────────────────────
function shouldRun(config) {
  if (!config.enabled) return false
  if (!config.sourcePaths?.length || !config.destFolder) return false

  const now     = new Date()
  const lastRun = config.lastRun ? new Date(config.lastRun) : null

  if (config.schedule === 'hourly') {
    if (!lastRun) return true
    return (now - lastRun) >= (60 * 60 * 1000)
  }

  if (config.schedule === 'daily') {
    if (!lastRun) return true
    const elapsed = now - lastRun
    // Must be at least 23 h since last run AND the current hour must match or exceed
    return elapsed >= (23 * 60 * 60 * 1000) && now.getHours() >= (config.hour ?? 2)
  }

  if (config.schedule === 'weekly') {
    if (!lastRun) return true
    const elapsed = now - lastRun
    return (
      elapsed >= (6 * 24 * 60 * 60 * 1000) &&
      now.getDay()   === (config.dayOfWeek ?? 0) &&
      now.getHours() >= (config.hour ?? 2)
    )
  }

  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Plain ZIP backup (no encryption)
// ─────────────────────────────────────────────────────────────────────────────
async function createPlainZip(sourcePaths, destPath, onProgress) {
  let processedFiles = 0
  return new Promise((resolve, reject) => {
    const fileOut = fs.createWriteStream(destPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    archive.on('error', reject)
    fileOut.on('error', reject)
    fileOut.on('close', resolve)

    archive.on('entry', (entry) => {
      processedFiles++
      onProgress?.({
        phase: 'archiving',
        processedFiles,
        currentFile: path.basename(entry.name || ''),
        percent: 0,
      })
    })

    for (const src of sourcePaths) {
      try {
        const stat = fs.statSync(src)
        if (stat.isDirectory()) archive.directory(src, path.basename(src))
        else archive.file(src, { name: path.basename(src) })
      } catch { /* skip unreadable sources */ }
    }

    archive.pipe(fileOut)
    archive.finalize()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Run a single backup pass
// ─────────────────────────────────────────────────────────────────────────────
async function runAutoBackup(config) {
  const { Notification } = require('electron')
  const now      = new Date()
  const stamp    = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
  const useEnc   = config.usePassword && isEncryptionAvailable() && hasPassword()
  const ext      = useEnc ? 'mfab' : 'zip'
  const filename = `auto-backup-${stamp}.${ext}`
  const destPath = path.join(config.destFolder, filename)

  // Ensure destination folder exists
  if (!fs.existsSync(config.destFolder)) {
    fs.mkdirSync(config.destFolder, { recursive: true })
  }

  const onProgress = (prog) => mainWindowRef?.webContents?.send('autobkp:progress', prog)

  try {
    if (useEnc) {
      const password = loadPassword()
      if (!password) throw new Error('Password not found in secure storage')
      await createFileBackup({
        password,
        sourcePaths: config.sourcePaths,
        destPath,
        onProgress,
      })
    } else {
      await createPlainZip(config.sourcePaths, destPath, onProgress)
    }

    const updated = {
      ...config,
      lastRun:    now.toISOString(),
      lastStatus: 'success',
      lastError:  null,
      lastFile:   destPath,
    }
    saveConfig(updated)
    mainWindowRef?.webContents?.send('autobkp:status', {
      status: 'success', lastRun: updated.lastRun, lastFile: destPath,
    })

    if (Notification.isSupported()) {
      new Notification({
        title: 'MyFiles AI — Auto Backup',
        body:  `Backup complete: ${filename}`,
      }).show()
    }

    return { success: true, config: updated }
  } catch (err) {
    const updated = {
      ...config,
      lastRun:    now.toISOString(),
      lastStatus: 'error',
      lastError:  err.message,
    }
    saveConfig(updated)
    mainWindowRef?.webContents?.send('autobkp:status', {
      status: 'error', error: err.message, lastRun: updated.lastRun,
    })

    if (Notification.isSupported()) {
      new Notification({
        title: 'MyFiles AI — Backup Failed',
        body:  err.message.slice(0, 120),
      }).show()
    }

    return { success: false, error: err.message, config: updated }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduler
// ─────────────────────────────────────────────────────────────────────────────
function startScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer)
  schedulerTimer = setInterval(async () => {
    const config = loadConfig()
    if (shouldRun(config)) {
      await runAutoBackup(config)
    }
  }, 60 * 1000)   // tick every 60 seconds
}

function stopScheduler() {
  if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null }
}

function initAutoBackup(mainWindow) {
  mainWindowRef = mainWindow
  startScheduler()
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  initAutoBackup,
  stopScheduler,
  loadConfig,
  saveConfig,
  runAutoBackup,
  savePassword,
  hasPassword,
  deletePassword,
  isEncryptionAvailable,
}
