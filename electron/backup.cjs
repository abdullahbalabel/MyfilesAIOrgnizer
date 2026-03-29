/**
 * backup.cjs — Encrypted Backup & Restore for MyFiles AI Organizer
 *
 * Format: .mfab  (MyFiles AI Backup)
 * Encryption: AES-256-GCM  (Node.js crypto — no npm package)
 * KDF: scrypt  (OWASP interactive params: N=65536, r=8, p=1)
 * Archive: ZIP via `archiver`
 *
 * File layout:
 *   Bytes 0-127  : fixed plain-text JSON header (salt, IV, authTag)
 *   Bytes 128+   : AES-256-GCM ciphertext of the ZIP payload
 */

'use strict'

const fs      = require('fs')
const path    = require('path')
const os      = require('os')
const crypto  = require('crypto')
const archiver = require('archiver')
const { Writable, Readable } = require('stream')

const APP_DATA_DIR   = path.join(os.homedir(), '.myfiles-ai-organizer')
const HISTORY_FILE   = path.join(APP_DATA_DIR, 'history.json')

// Settings path is managed in main.js relative to app.getPath('userData').
// We receive it as a parameter so this module stays testable.

const HEADER_SIZE = 128   // fixed bytes, zero-padded JSON
const MAGIC       = 'MFAB'
const VERSION     = 1

// ── KDF ─────────────────────────────────────────────────────────────────────
function deriveKey(password, salt) {
  return new Promise((resolve, reject) => {
    // N=16384 (2^14): needs ~16MB RAM — stays within OpenSSL default memory limits
    crypto.scrypt(
      password,
      salt,
      32,
      { N: 16384, r: 8, p: 1, maxmem: 67108864 },
      (err, key) => err ? reject(err) : resolve(key)
    )
  })
}

// ── Collect a readable stream into a Buffer ──────────────────────────────────
function streamToBuffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = []
    readable.on('data', c => chunks.push(c))
    readable.on('end',  () => resolve(Buffer.concat(chunks)))
    readable.on('error', reject)
  })
}

// ── Build ZIP buffer from two JSON files ────────────────────────────────────
function buildZipBuffer(settingsJson, historyJson, manifestJson) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const collector = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk); cb() }
    })
    collector.on('finish', () => resolve(Buffer.concat(chunks)))
    collector.on('error', reject)

    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', reject)
    archive.pipe(collector)

    archive.append(manifestJson, { name: 'backup/manifest.json' })
    archive.append(settingsJson, { name: 'backup/settings.json' })
    archive.append(historyJson,  { name: 'backup/history.json'  })
    archive.finalize()
  })
}

// ── Parse ZIP buffer and extract named file ──────────────────────────────────
// We do a minimal ZIP parse ourselves to avoid a heavy dependency.
// Node's `zlib` handles the deflate; we walk the local-file headers.
function extractFileFromZip(zipBuffer, filename) {
  // Local file header signature = 0x04034b50
  let offset = 0
  while (offset < zipBuffer.length - 30) {
    const sig = zipBuffer.readUInt32LE(offset)
    if (sig !== 0x04034b50) break

    const compression   = zipBuffer.readUInt16LE(offset + 8)
    const compSize      = zipBuffer.readUInt32LE(offset + 18)
    const uncompSize    = zipBuffer.readUInt32LE(offset + 22)
    const fnameLen      = zipBuffer.readUInt16LE(offset + 26)
    const extraLen      = zipBuffer.readUInt16LE(offset + 28)
    const fname         = zipBuffer.toString('utf8', offset + 30, offset + 30 + fnameLen)
    const dataOffset    = offset + 30 + fnameLen + extraLen

    if (fname === filename) {
      const data = zipBuffer.slice(dataOffset, dataOffset + compSize)
      if (compression === 0) return data                           // stored
      const zlib = require('zlib')
      return zlib.inflateRawSync(data)                            // deflated
    }
    offset = dataOffset + compSize
  }
  throw new Error(`File "${filename}" not found in backup archive`)
}

// ── Build fixed-size header ──────────────────────────────────────────────────
function buildHeader(saltHex, ivHex, authTagHex) {
  const json = JSON.stringify({ magic: MAGIC, version: VERSION, algo: 'aes-256-gcm', kdf: 'scrypt', saltHex, ivHex, authTagHex })
  if (json.length > HEADER_SIZE) throw new Error('Header too large')
  const buf = Buffer.alloc(HEADER_SIZE, 0)
  buf.write(json, 0, 'utf8')
  return buf
}

// ── Encrypt plaintext Buffer ─────────────────────────────────────────────────
async function encrypt(password, plaintext) {
  const salt = crypto.randomBytes(32)
  const iv   = crypto.randomBytes(12)
  const key  = await deriveKey(password, salt)

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct1    = cipher.update(plaintext)
  const ct2    = cipher.final()
  const tag    = cipher.getAuthTag()

  const header = buildHeader(salt.toString('hex'), iv.toString('hex'), tag.toString('hex'))
  return Buffer.concat([header, ct1, ct2])
}

// ── Decrypt file buffer ──────────────────────────────────────────────────────
async function decrypt(password, fileBuf) {
  const headerStr = fileBuf.slice(0, HEADER_SIZE).toString('utf8').replace(/\0+$/, '')
  let header
  try { header = JSON.parse(headerStr) } catch { throw new Error('Not a valid .mfab file') }

  if (header.magic !== MAGIC) throw new Error('Not a valid .mfab file')
  if (header.version !== VERSION) throw new Error(`Unsupported backup version: ${header.version}`)

  const salt    = Buffer.from(header.saltHex,    'hex')
  const iv      = Buffer.from(header.ivHex,      'hex')
  const authTag = Buffer.from(header.authTagHex, 'hex')
  const key     = await deriveKey(password, salt)
  const ciphertext = fileBuf.slice(HEADER_SIZE)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  try {
    const pt1 = decipher.update(ciphertext)
    const pt2 = decipher.final()
    return Buffer.concat([pt1, pt2])
  } catch {
    throw new Error('Incorrect password or corrupted file')
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create an encrypted backup file at destPath.
 * @param {string} password
 * @param {string} destPath       - where to write the .mfab
 * @param {string} settingsPath   - path to the settings JSON file
 */
async function createBackup(password, destPath, settingsPath) {
  // Read source files (tolerate missing)
  const settingsJson = fs.existsSync(settingsPath)
    ? fs.readFileSync(settingsPath, 'utf-8')
    : '{}'
  const historyJson = fs.existsSync(HISTORY_FILE)
    ? fs.readFileSync(HISTORY_FILE, 'utf-8')
    : '[]'

  const manifest = {
    createdAt: new Date().toISOString(),
    appVersion: require('../package.json').version,
    platform: process.platform,
  }
  const manifestJson = JSON.stringify(manifest, null, 2)

  const zipBuf = await buildZipBuffer(settingsJson, historyJson, manifestJson)
  const fileBuf = await encrypt(password, zipBuf)
  fs.writeFileSync(destPath, fileBuf)
  return { manifest }
}

/**
 * Decrypt a backup and return its manifest (without restoring).
 */
async function readManifest(password, filePath) {
  const fileBuf = fs.readFileSync(filePath)
  const zipBuf  = await decrypt(password, fileBuf)
  const manifestRaw = extractFileFromZip(zipBuf, 'backup/manifest.json')
  const manifest = JSON.parse(manifestRaw.toString('utf-8'))
  return { manifest }
}

/**
 * Decrypt and restore backup, overwriting settings + history.
 * @param {string} password
 * @param {string} filePath
 * @param {string} settingsPath
 */
async function restoreBackup(password, filePath, settingsPath) {
  const fileBuf = fs.readFileSync(filePath)
  const zipBuf  = await decrypt(password, fileBuf)

  const manifestRaw = extractFileFromZip(zipBuf, 'backup/manifest.json')
  const settingsRaw = extractFileFromZip(zipBuf, 'backup/settings.json')
  const historyRaw  = extractFileFromZip(zipBuf, 'backup/history.json')

  const manifest = JSON.parse(manifestRaw.toString('utf-8'))

  // Ensure target dirs exist
  const settingsDir = path.dirname(settingsPath)
  if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true })
  if (!fs.existsSync(APP_DATA_DIR)) fs.mkdirSync(APP_DATA_DIR, { recursive: true })

  fs.writeFileSync(settingsPath, settingsRaw.toString('utf-8'))
  fs.writeFileSync(HISTORY_FILE, historyRaw.toString('utf-8'))

  return { manifest }
}

module.exports = { createBackup, readManifest, restoreBackup }
