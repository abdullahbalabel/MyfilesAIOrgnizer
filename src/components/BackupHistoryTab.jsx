import { useState, useEffect, useCallback } from 'react'
import {
  FolderOpen, RefreshCw, Loader2, ShieldCheck,
  FileArchive, Trash2, RotateCcw, AlertTriangle, Archive,
} from 'lucide-react'

const isElectron = !!window.electron

function formatBytes(b) {
  if (!b) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${(b / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

// ── Single backup file card ───────────────────────────────────────────────────
function BackupCard({ file, onRestore, onDelete, deleteConfirm, setDeleteConfirm }) {
  const isConfirming = deleteConfirm === file.path

  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--bg-base)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      display: 'grid',
      gridTemplateColumns: '36px 1fr auto',
      gap: 12,
      alignItems: 'center',
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--purple)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Type icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: file.isEncrypted ? 'rgba(139,92,246,0.15)' : 'rgba(6,182,212,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {file.isEncrypted
          ? <ShieldCheck size={18} style={{ color: 'var(--purple-light)' }} />
          : <Archive size={18} style={{ color: 'var(--cyan)' }} />}
      </div>

      {/* Info */}
      <div style={{ overflow: 'hidden' }}>
        <div style={{
          fontWeight: 600, fontSize: 13, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 3,
        }}>
          {file.name}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{formatDate(file.mtime)}</span>
          <span>·</span>
          <span>{formatBytes(file.size)}</span>
          <span>·</span>
          <span style={{
            color: file.isEncrypted ? 'var(--purple-light)' : 'var(--cyan)',
            fontWeight: 600,
          }}>
            {file.isEncrypted ? '🔒 Encrypted' : '📦 Unencrypted ZIP'}
          </span>
          {!file.valid && <span style={{ color: '#ef4444' }}>⚠ Invalid</span>}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {file.isEncrypted && (
          <button
            className="btn btn-secondary"
            onClick={() => onRestore(file.path)}
            title="Restore this backup"
            style={{ fontSize: 11, padding: '5px 10px', gap: 5 }}
          >
            <RotateCcw size={12} /> Restore
          </button>
        )}

        {isConfirming ? (
          <>
            <button
              className="btn"
              onClick={() => onDelete(file)}
              style={{
                fontSize: 11, padding: '5px 10px',
                background: '#ef4444', color: 'white',
                border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              }}
            >
              Confirm Delete
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setDeleteConfirm(null)}
              style={{ fontSize: 11, padding: '5px 10px' }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={() => setDeleteConfirm(file.path)}
            title="Delete this backup file"
            style={{ fontSize: 11, padding: '5px 10px', gap: 5, color: '#ef4444' }}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function BackupHistoryTab({ onRestoreFile, showToast }) {
  const [folder,        setFolder]        = useState('')
  const [files,         setFiles]         = useState([])
  const [scanning,      setScanning]      = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [status,        setStatus]        = useState(null)

  // Auto-load the auto-backup destination on mount
  useEffect(() => {
    if (!isElectron) return
    window.electron.autoBkpGetConfig()
      .then(res => {
        const dest = res.config?.destFolder
        if (dest) { setFolder(dest); doScan(dest) }
      })
      .catch(() => {})
  }, [])

  async function pickFolder() {
    if (!isElectron) return
    const fp = await window.electron.historySelectFolder()
    if (fp) { setFolder(fp); doScan(fp) }
  }

  const doScan = useCallback(async (fp) => {
    if (!fp || !isElectron) return
    setScanning(true); setStatus(null)
    const result = await window.electron.historyScan(fp)
    setScanning(false)
    if (result.success) {
      setFiles(result.files)
      if (result.files.length === 0) setStatus({ type: 'info', message: 'No backup files found in this folder.' })
    } else {
      setFiles([])
      setStatus({ type: 'error', message: result.error })
    }
  }, [])

  async function handleDelete(file) {
    if (!isElectron) return
    const result = await window.electron.historyDelete(file.path)
    if (result.success) {
      setFiles(prev => prev.filter(f => f.path !== file.path))
      setDeleteConfirm(null)
      showToast?.(`Deleted: ${file.name}`, 'success')
    } else {
      setStatus({ type: 'error', message: result.error })
      setDeleteConfirm(null)
    }
  }

  function handleRestore(filePath) {
    onRestoreFile?.(filePath)
  }

  const statusStyle = {
    success: { bg: 'rgba(34,197,94,0.1)',  border: '#22c55e', color: '#22c55e' },
    error:   { bg: 'rgba(239,68,68,0.1)',  border: '#ef4444', color: '#ef4444' },
    info:    { bg: 'rgba(139,92,246,0.1)', border: 'var(--purple)', color: 'var(--purple-light)' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Folder picker */}
      <div className="input-group">
        <label className="input-label">Backup Folder to Browse</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            readOnly
            value={folder}
            placeholder="Click 📁 to choose a folder containing .mfab / .zip backups…"
            style={{ flex: 1, cursor: 'default', color: folder ? 'var(--text-primary)' : 'var(--text-muted)' }}
          />
          <button className="btn btn-secondary" onClick={pickFolder} disabled={!isElectron} style={{ flexShrink: 0 }}>
            <FolderOpen size={14} />
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => doScan(folder)}
            disabled={!folder || scanning}
            style={{ flexShrink: 0, gap: 5 }}
            title="Refresh"
          >
            <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13,
          ...statusStyle[status.type],
        }}>
          {status.message}
        </div>
      )}

      {/* Loading */}
      {scanning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" /> Scanning folder…
        </div>
      )}

      {/* File list */}
      {!scanning && files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 6, fontSize: 12, color: 'var(--text-muted)',
          }}>
            <span><strong style={{ color: 'var(--text-secondary)' }}>{files.length}</strong> backup{files.length !== 1 ? 's' : ''} found</span>
            <span>{formatBytes(files.reduce((t, f) => t + f.size, 0))} total</span>
          </div>

          {files.map(file => (
            <BackupCard
              key={file.path}
              file={file}
              onRestore={handleRestore}
              onDelete={handleDelete}
              deleteConfirm={deleteConfirm}
              setDeleteConfirm={setDeleteConfirm}
            />
          ))}
        </div>
      )}

      {/* Empty state — no folder selected */}
      {!scanning && !folder && files.length === 0 && !status && (
        <div
          onClick={pickFolder}
          style={{
            border: '2px dashed var(--border)',
            borderRadius: 'var(--radius)',
            padding: '36px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--purple)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <FileArchive size={30} style={{ color: 'var(--purple)', display: 'block', margin: '0 auto 10px' }} />
          Click to select a folder and browse your backup history
          <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)' }}>
            Shows all .mfab (encrypted) and .zip (unencrypted) backup files
          </div>
        </div>
      )}
    </div>
  )
}
