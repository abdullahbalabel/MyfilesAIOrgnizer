import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ShieldCheck, FolderOpen, Plus, X, Loader2,
  Eye, EyeOff, AlertTriangle, HardDrive, RotateCcw,
  FileArchive, CheckCircle2, Clock,
} from 'lucide-react'
import PasswordStrengthBar from './PasswordStrengthBar'
import AutoBackupTab from './AutoBackupTab'
import BackupHistoryTab from './BackupHistoryTab'

const isElectron = !!window.electron

function formatBytes(b) {
  if (!b) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return `${(b / Math.pow(k, i)).toFixed(1)} ${units[i]}`
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ percent, label, sub }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{label}</span>
          <span style={{ fontWeight: 700, color: 'var(--purple-light)' }}>{percent}%</span>
        </div>
      )}
      <div style={{ height: 8, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${percent}%`,
          background: 'linear-gradient(90deg, var(--purple), var(--cyan))',
          borderRadius: 99,
          transition: 'width 0.3s ease',
        }} />
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ type, message }) {
  if (!message) return null
  const s = {
    success: { bg: 'rgba(34,197,94,0.1)',  border: '#22c55e', color: '#22c55e', icon: '✅' },
    error:   { bg: 'rgba(239,68,68,0.1)',  border: '#ef4444', color: '#ef4444', icon: '❌' },
    warn:    { bg: 'rgba(234,179,8,0.1)',   border: '#eab308', color: '#eab308', icon: '⚠️' },
    info:    { bg: 'rgba(139,92,246,0.1)', border: 'var(--purple)', color: 'var(--purple-light)', icon: 'ℹ️' },
  }[type] || {}
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 14px',
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 'var(--radius-sm)', color: s.color, fontSize: 13, lineHeight: 1.5,
    }}>
      <span style={{ flexShrink: 0 }}>{s.icon}</span>
      <span>{message}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE BACKUP TAB
// ─────────────────────────────────────────────────────────────────────────────
// ── Browser-mode warning banner ──────────────────────────────────────────────
function ElectronRequiredBanner() {
  if (isElectron) return null
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '12px 16px',
      background: 'rgba(234,179,8,0.08)',
      border: '1px solid rgba(234,179,8,0.3)',
      borderRadius: 'var(--radius-sm)',
      fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
      marginBottom: 4,
    }}>
      <AlertTriangle size={15} style={{ color: '#eab308', flexShrink: 0, marginTop: 2 }} />
      <span>
        <strong style={{ color: '#eab308' }}>Electron required for file system access.</strong>{' '}
        Backup and restore operations are unavailable in browser mode. Launch with{' '}
        <code style={{ fontSize: 11, background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>npm run electron:dev</code>{' '}
        to use all features.
      </span>
    </div>
  )
}

function CreateBackupTab({ showToast }) {
  const [sources,    setSources]    = useState([])        // string[] of folder paths
  const [destPath,   setDestPath]   = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [scanInfo,   setScanInfo]   = useState(null)      // { totalFiles, totalBytes }
  const [scanning,   setScanning]   = useState(false)
  const [progress,   setProgress]   = useState(null)      // live progress object
  const [status,     setStatus]     = useState(null)      // { type, message }
  const [running,    setRunning]    = useState(false)

  const mismatch  = confirm && password !== confirm
  const tooShort  = password.length > 0 && password.length < 8
  const canStart  = isElectron && sources.length > 0 && destPath && password.length >= 8
                    && password === confirm && !running

  // Subscribe to progress events
  useEffect(() => {
    if (!isElectron) return
    const unsub = window.electron.onFileBkpProgress((prog) => setProgress(prog))
    return unsub
  }, [])

  // Auto-scan when sources change
  useEffect(() => {
    if (!sources.length || !isElectron) { setScanInfo(null); return }
    let cancelled = false
    setScanning(true)
    window.electron.fileBkpScan(sources).then(res => {
      if (!cancelled) {
        setScanInfo(res.success ? res : null)
        setScanning(false)
      }
    })
    return () => { cancelled = true }
  }, [JSON.stringify(sources)])

  async function addSources() {
    if (!isElectron) {
      console.error('[FileBackup] addSources: file system access requires Electron')
      showToast('File system access requires Electron. Launch with npm run electron:dev.', 'error')
      return
    }
    const paths = await window.electron.fileBkpSelectSources()
    if (paths?.length) setSources(prev => [...new Set([...prev, ...paths])])
  }

  function removeSource(p) { setSources(prev => prev.filter(s => s !== p)) }

  async function pickDest() {
    if (!isElectron) {
      console.error('[FileBackup] pickDest: file system access requires Electron')
      showToast('File system access requires Electron. Launch with npm run electron:dev.', 'error')
      return
    }
    const fp = await window.electron.fileBkpSelectDest()
    if (fp) setDestPath(fp)
  }

  async function handleStart() {
    if (!isElectron) {
      console.error('[FileBackup] handleStart: backup requires Electron — file system access not available in browser mode')
      showToast('Backup requires Electron. Launch with npm run electron:dev to use this feature.', 'error')
      return
    }
    if (!canStart) return
    setRunning(true)
    setStatus({ type: 'info', message: 'Backup starting…' })
    setProgress(null)

    const result = await window.electron.fileBkpCreate(password, sources, destPath)

    if (result.success) {
      setStatus({ type: 'success', message: `✅ Backup complete! ${result.manifest.totalFiles} files saved to ${destPath}` })
      showToast('File backup created successfully!', 'success')
      setProgress(null)
      setPassword(''); setConfirm(''); setSources([]); setDestPath('')
    } else if (result.cancelled) {
      setStatus({ type: 'warn', message: 'Backup was cancelled.' })
      setProgress(null)
    } else {
      setStatus({ type: 'error', message: result.error || 'Backup failed' })
    }
    setRunning(false)
  }

  function handleCancel() {
    window.electron?.fileBkpCancel()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <ElectronRequiredBanner />

      {/* Source list */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label className="input-label" style={{ marginBottom: 0 }}>Source Folders / Drives</label>
          <button
            className="btn btn-secondary"
            onClick={addSources}
            disabled={!isElectron || running}
            style={{ fontSize: 12, padding: '5px 12px', gap: 6 }}
          >
            <Plus size={13} /> Add Folder
          </button>
        </div>

        {sources.length === 0 ? (
          <div
            onClick={addSources}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius)',
              padding: '28px 20px',
              textAlign: 'center',
              cursor: isElectron ? 'pointer' : 'default',
              color: 'var(--text-muted)',
              fontSize: 13,
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--purple)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <HardDrive size={28} style={{ color: 'var(--purple)', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            Click to select folders or drives to back up
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sources.map(src => (
              <div key={src} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
              }}>
                <FolderOpen size={14} style={{ color: 'var(--purple)', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                  {src}
                </span>
                <button
                  onClick={() => removeSource(src)}
                  disabled={running}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            {/* Scan summary */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              {scanning
                ? <><Loader2 size={12} className="animate-spin" /> Counting files…</>
                : scanInfo
                ? <>~&nbsp;<strong style={{ color: 'var(--text-secondary)' }}>{scanInfo.totalFiles.toLocaleString()}</strong>&nbsp;files · <strong style={{ color: 'var(--text-secondary)' }}>{formatBytes(scanInfo.totalBytes)}</strong> estimated</>
                : null}
            </div>
          </div>
        )}
      </div>

      {/* Destination */}
      <div className="input-group">
        <label className="input-label">Save Backup To</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Click 📁 to choose a destination…"
            value={destPath}
            readOnly
            style={{ flex: 1, cursor: 'default', color: destPath ? 'var(--text-primary)' : 'var(--text-muted)' }}
          />
          <button className="btn btn-secondary" onClick={pickDest} disabled={!isElectron || running} style={{ flexShrink: 0 }}>
            <FolderOpen size={15} />
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="input-group">
        <label className="input-label">Encryption Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw ? 'text' : 'password'}
            className="input"
            placeholder="Choose a strong password…"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={running}
            style={{ paddingRight: 40 }}
          />
          <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <PasswordStrengthBar password={password} />
        {tooShort && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Minimum 8 characters</div>}
      </div>

      <div className="input-group">
        <label className="input-label">Confirm Password</label>
        <input
          type="password"
          className="input"
          placeholder="Confirm your password…"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          disabled={running}
          style={{ border: mismatch ? '1px solid #ef4444' : undefined }}
        />
        {mismatch && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Passwords do not match</div>}
      </div>

      {/* No-recovery warning */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        <AlertTriangle size={13} style={{ color: '#eab308', flexShrink: 0, marginTop: 2 }} />
        <span><strong style={{ color: '#eab308' }}>No password recovery.</strong> Forgotten passwords cannot be recovered. Store it securely.</span>
      </div>

      {/* Progress */}
      {progress && running && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          <ProgressBar
            percent={progress.percent || 0}
            label={progress.phase === 'scanning' ? 'Counting files…' : `${progress.currentFile || 'Preparing…'}`}
            sub={progress.totalFiles
              ? `${(progress.processedFiles || 0).toLocaleString()} / ${(progress.totalFiles || 0).toLocaleString()} files · ${formatBytes(progress.processedBytes)} / ${formatBytes(progress.totalBytes)}`
              : undefined}
          />
          <button className="btn btn-secondary" onClick={handleCancel} style={{ alignSelf: 'flex-end', fontSize: 12, padding: '5px 14px' }}>
            Cancel
          </button>
        </div>
      )}

      {/* Action button */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleStart} disabled={!canStart}>
          {running
            ? <><Loader2 size={15} className="animate-spin" /> Running…</>
            : <><ShieldCheck size={15} /> Start Encrypted Backup</>}
        </button>
      </div>

      <StatusBadge type={status?.type} message={status?.message} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTORE BACKUP TAB
// ─────────────────────────────────────────────────────────────────────────────
function RestoreBackupTab({ showToast, initialFilePath }) {
  const [filePath,  setFilePath]  = useState(initialFilePath || '')
  const [password,  setPassword]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [destPath,  setDestPath]  = useState('')
  const [manifest,  setManifest]  = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [progress,  setProgress]  = useState(null)
  const [running,   setRunning]   = useState(false)
  const [status,    setStatus]    = useState(null)

  useEffect(() => {
    if (!isElectron) return
    const unsub = window.electron.onFileBkpProgress(prog => setProgress(prog))
    return unsub
  }, [])

  // Pre-fill file path when navigated here from History tab
  useEffect(() => {
    if (initialFilePath) {
      setFilePath(initialFilePath)
      setManifest(null); setConfirmed(false); setStatus(null)
    }
  }, [initialFilePath])

  async function pickFile() {
    if (!isElectron) return
    const fp = await window.electron.fileBkpSelectFile()
    if (fp) { setFilePath(fp); setManifest(null); setConfirmed(false); setStatus(null) }
  }

  async function pickDest() {
    if (!isElectron) return
    const fp = await window.electron.fileBkpSelectRestoreDest()
    if (fp) setDestPath(fp)
  }

  async function handleVerify() {
    if (!filePath || !password || verifying) return
    setVerifying(true); setManifest(null); setStatus(null)
    const result = await window.electron.fileBkpReadManifest(filePath, password)
    setVerifying(false)
    if (result.success) {
      setManifest(result.manifest)
      setStatus({ type: 'success', message: 'Password verified — review the backup info below.' })
    } else {
      setStatus({ type: 'error', message: result.error || 'Incorrect password or corrupted file' })
    }
  }

  async function handleRestore() {
    if (!manifest || !confirmed || !destPath || running) return
    setRunning(true)
    setStatus({ type: 'info', message: 'Decrypting and restoring files…' })
    const result = await window.electron.fileBkpRestore(password, filePath, destPath)
    if (result.success) {
      setStatus({ type: 'success', message: `Restore complete! ${result.extracted} files extracted to ${destPath}` })
      showToast(`Restored ${result.extracted} files successfully`, 'success')
      setFilePath(''); setPassword(''); setDestPath(''); setManifest(null); setConfirmed(false); setProgress(null)
    } else {
      setStatus({ type: 'error', message: result.error || 'Restore failed' })
    }
    setRunning(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* File picker */}
      <div className="input-group">
        <label className="input-label">Backup File (.mfab)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Click 📁 to select a backup file…" value={filePath} readOnly
            style={{ flex: 1, cursor: 'default', color: filePath ? 'var(--text-primary)' : 'var(--text-muted)' }} />
          <button className="btn btn-secondary" onClick={pickFile} disabled={!isElectron || running} style={{ flexShrink: 0 }}>
            <FileArchive size={15} />
          </button>
        </div>
      </div>

      {/* Password + verify */}
      <div className="input-group">
        <label className="input-label">Backup Password</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type={showPw ? 'text' : 'password'}
              className="input"
              placeholder="Enter the backup password…"
              value={password}
              onChange={e => { setPassword(e.target.value); setManifest(null); setConfirmed(false) }}
              disabled={running}
              style={{ paddingRight: 40 }}
            />
            <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button className="btn btn-secondary" onClick={handleVerify} disabled={!filePath || !password || verifying || running} style={{ flexShrink: 0 }}>
            {verifying ? <Loader2 size={14} className="animate-spin" /> : 'Verify'}
          </button>
        </div>
      </div>

      <StatusBadge type={status?.type} message={status?.message} />

      {/* Manifest */}
      {manifest && (
        <div style={{ padding: '14px 16px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>Backup Information</div>
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '5px 0', color: 'var(--text-secondary)' }}>
            {[
              ['Created', new Date(manifest.createdAt).toLocaleString()],
              ['App Version', `v${manifest.appVersion}`],
              ['Platform', manifest.platform],
              ['Total Files', manifest.totalFiles?.toLocaleString()],
              ['Total Size', formatBytes(manifest.totalBytes)],
              ['Sources', manifest.sourcePaths?.join(', ')],
            ].map(([k, v]) => (
              <>
                <span key={`k-${k}`} style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span key={`v-${k}`} style={{ wordBreak: 'break-all' }}>{v}</span>
              </>
            ))}
          </div>
        </div>
      )}

      {/* Restore destination */}
      {manifest && (
        <div className="input-group">
          <label className="input-label">Restore Destination</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" placeholder="Click 📁 to choose where to restore…" value={destPath} readOnly
              style={{ flex: 1, cursor: 'default', color: destPath ? 'var(--text-primary)' : 'var(--text-muted)' }} />
            <button className="btn btn-secondary" onClick={pickDest} disabled={!isElectron || running} style={{ flexShrink: 0 }}>
              <FolderOpen size={15} />
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Files will be extracted inside this folder, preserving the original directory structure.
          </div>
        </div>
      )}

      {/* Overwrite confirm */}
      {manifest && destPath && (
        <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              style={{ accentColor: 'var(--purple)', marginTop: 3, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              I understand this will write files to <strong style={{ color: 'var(--text-primary)' }}>{destPath}</strong> and may overwrite existing files.
            </span>
          </label>
        </div>
      )}

      {/* Progress */}
      {progress && running && (
        <div style={{ padding: '14px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          <ProgressBar
            percent={progress.percent || 0}
            label={progress.currentFile || 'Restoring…'}
            sub={progress.totalFiles ? `${(progress.processedFiles || 0).toLocaleString()} / ${progress.totalFiles.toLocaleString()} files` : undefined}
          />
        </div>
      )}

      {/* Restore button */}
      {manifest && destPath && (
        <button className="btn btn-primary" onClick={handleRestore} disabled={!confirmed || running} style={{ alignSelf: 'flex-start' }}>
          {running
            ? <><Loader2 size={15} className="animate-spin" /> Restoring…</>
            : <><RotateCcw size={15} /> Restore Backup</>}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB BUTTON
// ─────────────────────────────────────────────────────────────────────────────
function Tab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '9px 22px',
        fontSize: 13, fontWeight: 600,
        color: active ? 'var(--purple-light)' : 'var(--text-muted)',
        borderBottom: active ? '2px solid var(--purple)' : '2px solid transparent',
        background: 'none', border: 'none', cursor: 'pointer',
        transition: 'var(--transition)',
      }}
    >
      <Icon size={14} />{label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function FileBackupPanel({ showToast }) {
  const [tab,             setTab]             = useState('create')
  const [prefilledFile,   setPrefilledFile]   = useState('')

  function handleRestoreFile(filePath) {
    setPrefilledFile(filePath)
    setTab('restore')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Page header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h2>File Backup & Restore</h2>
        <p>
          Create an encrypted, compressed backup of any folder, drive, or collection of files.
          Backups use AES-256-CBC encryption and are protected by a password you choose.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, paddingLeft: 32 }}>
        <Tab active={tab === 'create'}  onClick={() => setTab('create')}  icon={ShieldCheck}  label="Create Backup" />
        <Tab active={tab === 'restore'} onClick={() => setTab('restore')} icon={RotateCcw}    label="Restore Backup" />
        <Tab active={tab === 'auto'}    onClick={() => setTab('auto')}    icon={Clock}        label="Auto-Backup" />
        <Tab active={tab === 'history'} onClick={() => setTab('history')} icon={FileArchive}  label="History" />
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ maxWidth: 680 }}>
          {tab === 'create'  && <CreateBackupTab  showToast={showToast} />}
          {tab === 'restore' && <RestoreBackupTab showToast={showToast} initialFilePath={prefilledFile} />}
          {tab === 'auto'    && <AutoBackupTab    showToast={showToast} />}
          {tab === 'history' && <BackupHistoryTab showToast={showToast} onRestoreFile={handleRestoreFile} />}
        </div>
      </div>
    </div>
  )
}
