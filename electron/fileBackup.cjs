/**
 * fileBackup.cjs — Streaming File/Folder/Drive Backup & Restore
 *
 * Encryption: AES-256-CBC (streaming) + HMAC-SHA256 (Encrypt-then-MAC)
 * KDF:        scrypt  N=65536, r=8, p=1, keylen=64
 * Archive:    ZIP via `archiver` (streaming)
 *
 * File layout (.mfab v2):
 *   [ HEADER  — 256 bytes  ] plain JSON: magic, version, algo, kdf, saltHex, ivHex
 *   [ CIPHERTEXT STREAM    ] AES-256-CBC of the ZIP stream
 *   [ HMAC-SHA256 — 32 B   ] integrity tag over ALL ciphertext bytes
 */

'use strict'

const fs       = require('fs')
const path     = require('path')
const os       = require('os')
const crypto   = require('crypto')
const archiver = require('archiver')
const { Transform, Writable, pipeline } = require('stream')
const { promisify } = require('util')
const pipelineAsync = promisify(pipeline)

const MAGIC       = 'MFAB2'
const VERSION     = 2
const HEADER_SIZE = 256
const HMAC_SIZE   = 32   // SHA-256 output

// ── Cancel token ──────────────────────────────────────────────────────────────
// A simple object passed around so any layer can signal cancellation.
class CancelToken {
  constructor() { this.cancelled = false }
  cancel()      { this.cancelled = true }
  check()       { if (this.cancelled) throw new Error('Backup cancelled by user') }
}

// ── KDF ──────────────────────────────────────────────────────────────────────
function deriveKeys(password, salt) {
  return new Promise((resolve, reject) => {
    // Returns 64 bytes: first 32 = enc key, last 32 = mac key
    // N=16384 (2^14): needs ~16MB RAM — safe within OpenSSL default limits
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 67108864 }, (err, key) =>
      err ? reject(err) : resolve({ encKey: key.slice(0, 32), macKey: key.slice(32) })
    )
  })
}

// ── Build fixed-size header ───────────────────────────────────────────────────
function buildHeader(saltHex, ivHex) {
  const json = JSON.stringify({ magic: MAGIC, version: VERSION, algo: 'aes-256-cbc', kdf: 'scrypt', saltHex, ivHex })
  if (json.length > HEADER_SIZE) throw new Error('Header JSON too large')
  const buf = Buffer.alloc(HEADER_SIZE, 0)
  buf.write(json, 0, 'utf8')
  return buf
}

// ── Count files + total bytes in a list of source paths ──────────────────────
async function scanSources(sourcePaths) {
  let totalFiles = 0
  let totalBytes = 0

  async function walk(dir) {
    let entries
    try { entries = fs.readdirSync(dir) } catch { return }
    for (const entry of entries) {
      const full = path.join(dir, entry)
      let stat
      try { stat = fs.statSync(full) } catch { continue }
      if (stat.isDirectory()) {
        await walk(full)
      } else {
        totalFiles++
        totalBytes += stat.size
      }
    }
  }

  for (const src of sourcePaths) {
    const stat = fs.statSync(src)
    if (stat.isDirectory()) await walk(src)
    else { totalFiles++; totalBytes += stat.size }
  }

  return { totalFiles, totalBytes }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE BACKUP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object}   opts
 * @param {string}   opts.password
 * @param {string[]} opts.sourcePaths   Folders / files / drive roots to back up
 * @param {string}   opts.destPath      Output .mfab file path
 * @param {Function} opts.onProgress    (progressObj) => void
 * @param {CancelToken} opts.cancelToken
 */
async function createFileBackup({ password, sourcePaths, destPath, onProgress, cancelToken }) {
  cancelToken = cancelToken || new CancelToken()

  // 1. Scan to get totals
  onProgress?.({ phase: 'scanning', percent: 0, totalFiles: 0, processedFiles: 0, currentFile: 'Counting files…' })
  const { totalFiles, totalBytes } = await scanSources(sourcePaths)
  cancelToken.check()

  // 2. Derive keys
  const salt   = crypto.randomBytes(32)
  const iv     = crypto.randomBytes(16)   // AES-CBC: 16-byte IV
  const { encKey, macKey } = await deriveKeys(password, salt)
  cancelToken.check()

  // 3. Set up streams
  const fileOut = fs.createWriteStream(destPath)
  const header  = buildHeader(salt.toString('hex'), iv.toString('hex'))
  fileOut.write(header)

  const cipher  = crypto.createCipheriv('aes-256-cbc', encKey, iv)
  const hmac    = crypto.createHmac('sha256', macKey)

  // Tap cipher output into HMAC and write to file
  const cipherTap = new Transform({
    transform(chunk, _enc, cb) {
      hmac.update(chunk)
      this.push(chunk)
      cb()
    }
  })

  let processedFiles = 0
  let processedBytes = 0

  const archive = archiver('zip', { zlib: { level: 6 } })

  // Manifest — will be prepended inside zip
  const manifest = {
    magic: MAGIC,
    version: VERSION,
    createdAt: new Date().toISOString(),
    appVersion: require('../package.json').version,
    platform: process.platform,
    sourcePaths,
    totalFiles,
    totalBytes,
  }
  archive.append(JSON.stringify(manifest, null, 2), { name: 'backup/manifest.json' })

  // Add each source path to the archive
  for (const src of sourcePaths) {
    const stat = fs.statSync(src)
    if (stat.isDirectory()) {
      // Preserve directory structure: prefix = folder's basename
      const prefix = `files/${path.basename(src)}/`
      archive.directory(src, prefix)
    } else {
      archive.file(src, { name: `files/${path.basename(src)}` })
    }
  }

  // Track progress per entry
  archive.on('entry', (entry) => {
    cancelToken.check()
    processedFiles++
    processedBytes += entry.stats?.size || 0
    const percent = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0
    onProgress?.({
      phase: 'archiving',
      totalFiles,
      processedFiles,
      totalBytes,
      processedBytes,
      currentFile: path.basename(entry.name || ''),
      percent,
    })
  })

  // Pipe: archive → cipher → cipherTap → fileOut
  // { end: false } keeps fileOut open so we can append the HMAC after the stream drains
  await new Promise((resolve, reject) => {
    archive.on('error', reject)
    fileOut.on('error', reject)

    archive.pipe(cipher)
    cipher.pipe(cipherTap)
    cipherTap.pipe(fileOut, { end: false })   // ← don't auto-close fileOut

    cipherTap.on('end', resolve)
    archive.finalize()
  })

  // Append HMAC (32 bytes)
  const hmacDigest = hmac.digest()
  await new Promise((resolve, reject) => {
    fileOut.write(hmacDigest, (err) => err ? reject(err) : resolve())
  })
  await new Promise((resolve, reject) => fileOut.end(resolve))

  onProgress?.({ phase: 'done', percent: 100, totalFiles, processedFiles, totalBytes, processedBytes, currentFile: '' })
  return { manifest }
}

// ─────────────────────────────────────────────────────────────────────────────
// READ MANIFEST (decrypt header + first zip entry only)
// ─────────────────────────────────────────────────────────────────────────────
async function readFileBackupManifest(password, filePath) {
  const fileBuf = fs.readFileSync(filePath)

  // Parse header
  const headerStr = fileBuf.slice(0, HEADER_SIZE).toString('utf8').replace(/\0+$/, '')
  let header
  try { header = JSON.parse(headerStr) } catch { throw new Error('Not a valid .mfab file') }
  if (header.magic !== MAGIC) throw new Error('Not a valid .mfab v2 file')

  const salt   = Buffer.from(header.saltHex, 'hex')
  const iv     = Buffer.from(header.ivHex,   'hex')
  const { encKey, macKey } = await deriveKeys(password, salt)

  // Verify HMAC
  const ciphertext = fileBuf.slice(HEADER_SIZE, fileBuf.length - HMAC_SIZE)
  const storedHmac = fileBuf.slice(fileBuf.length - HMAC_SIZE)
  const computedHmac = crypto.createHmac('sha256', macKey).update(ciphertext).digest()
  if (!crypto.timingSafeEqual(storedHmac, computedHmac)) {
    throw new Error('Incorrect password or corrupted file')
  }

  // Decrypt
  const decipher  = crypto.createDecipheriv('aes-256-cbc', encKey, iv)
  const zipBuf    = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  // Extract manifest.json from zip
  const manifest = extractFileFromZip(zipBuf, 'backup/manifest.json')
  return { manifest: JSON.parse(manifest.toString('utf-8')), header }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTORE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Decrypts and extracts the backup archive to destPath.
 * For large files this reads the whole ciphertext into memory once for HMAC
 * verification, then streams through decipher into the zlib unarchiver.
 * NOTE: for very large backups a chunked streaming approach would be needed —
 * that's planned for Phase 2.
 */
async function restoreFileBackup({ password, filePath, destPath, onProgress }) {
  onProgress?.({ phase: 'scanning', percent: 0, currentFile: 'Verifying backup…' })

  const fileBuf    = fs.readFileSync(filePath)

  const headerStr  = fileBuf.slice(0, HEADER_SIZE).toString('utf8').replace(/\0+$/, '')
  let header
  try { header = JSON.parse(headerStr) } catch { throw new Error('Not a valid .mfab file') }
  if (header.magic !== MAGIC) throw new Error('Not a valid .mfab v2 file')

  const salt = Buffer.from(header.saltHex, 'hex')
  const iv   = Buffer.from(header.ivHex,   'hex')
  const { encKey, macKey } = await deriveKeys(password, salt)

  // Verify HMAC
  const ciphertext = fileBuf.slice(HEADER_SIZE, fileBuf.length - HMAC_SIZE)
  const storedHmac = fileBuf.slice(fileBuf.length - HMAC_SIZE)
  const computedHmac = crypto.createHmac('sha256', macKey).update(ciphertext).digest()
  if (!crypto.timingSafeEqual(storedHmac, computedHmac)) {
    throw new Error('Incorrect password or corrupted file')
  }

  // Decrypt
  onProgress?.({ phase: 'archiving', percent: 10, currentFile: 'Decrypting…' })
  const decipher = crypto.createDecipheriv('aes-256-cbc', encKey, iv)
  const zipBuf   = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  // Extract all files from zip to destPath
  if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true })

  const extracted = extractAllFromZip(zipBuf, destPath, (current, total, name) => {
    onProgress?.({
      phase: 'archiving',
      percent: 10 + Math.round((current / total) * 85),
      currentFile: name,
      processedFiles: current,
      totalFiles: total,
    })
  })

  // Read manifest
  const manifestRaw = extractFileFromZip(zipBuf, 'backup/manifest.json')
  const manifest = JSON.parse(manifestRaw.toString('utf-8'))

  onProgress?.({ phase: 'done', percent: 100, currentFile: '' })
  return { manifest, extracted }
}

// ── ZIP Central Directory parser ─────────────────────────────────────────────
// archiver writes 0 for compSize/uncompSize in local headers when it uses
// data descriptors (streaming). The Central Directory at the end of the file
// always has the correct values — so we must parse from there.
function parseCentralDirectory(zipBuf) {
  const zlib = require('zlib')

  // 1. Find End of Central Directory (EOCD) signature 0x06054b50
  //    It's near the end; scan backwards to handle optional ZIP comment.
  let eocdOffset = -1
  for (let i = zipBuf.length - 22; i >= Math.max(0, zipBuf.length - 65557); i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) throw new Error('Not a valid ZIP file (EOCD not found)')

  const numEntries = zipBuf.readUInt16LE(eocdOffset + 10)
  const cdOffset   = zipBuf.readUInt32LE(eocdOffset + 16)

  // 2. Walk the Central Directory
  const entries = []
  let offset = cdOffset
  for (let i = 0; i < numEntries; i++) {
    if (zipBuf.readUInt32LE(offset) !== 0x02014b50) break  // CD signature

    const compression  = zipBuf.readUInt16LE(offset + 10)
    const compSize     = zipBuf.readUInt32LE(offset + 20)
    const fnameLen     = zipBuf.readUInt16LE(offset + 28)
    const extraLen     = zipBuf.readUInt16LE(offset + 30)
    const commentLen   = zipBuf.readUInt16LE(offset + 32)
    const localOffset  = zipBuf.readUInt32LE(offset + 42)
    const fname        = zipBuf.toString('utf8', offset + 46, offset + 46 + fnameLen)

    // Resolve actual data offset from the local file header
    const localFnameLen  = zipBuf.readUInt16LE(localOffset + 26)
    const localExtraLen  = zipBuf.readUInt16LE(localOffset + 28)
    const dataOffset     = localOffset + 30 + localFnameLen + localExtraLen

    entries.push({ fname, compression, compSize, dataOffset })
    offset += 46 + fnameLen + extraLen + commentLen
  }

  return { entries, zlib }
}

function extractFileFromZip(zipBuf, filename) {
  const { entries, zlib } = parseCentralDirectory(zipBuf)
  const entry = entries.find(e => e.fname === filename)
  if (!entry) throw new Error(`File "${filename}" not found in archive`)

  const data = zipBuf.slice(entry.dataOffset, entry.dataOffset + entry.compSize)
  return entry.compression === 0 ? data : zlib.inflateRawSync(data)
}

function extractAllFromZip(zipBuf, destRoot, onEntry) {
  const { entries, zlib } = parseCentralDirectory(zipBuf)
  const fileEntries = entries.filter(e => !e.fname.endsWith('/'))
  const total = fileEntries.length
  let count = 0

  for (const { fname, compression, compSize, dataOffset } of fileEntries) {
    const destFile = path.join(destRoot, fname)
    const destDir  = path.dirname(destFile)
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

    const data    = zipBuf.slice(dataOffset, dataOffset + compSize)
    const content = compression === 0 ? data : zlib.inflateRawSync(data)
    fs.writeFileSync(destFile, content)
    count++
    onEntry?.(count, total, path.basename(fname))
  }

  return count
}

module.exports = { createFileBackup, readFileBackupManifest, restoreFileBackup, CancelToken, scanSources }
