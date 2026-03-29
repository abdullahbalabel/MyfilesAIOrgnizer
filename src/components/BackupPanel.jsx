import { useState } from 'react'
import {
  ShieldCheck, ShieldOff, FolderOpen, Loader2,
  Eye, EyeOff, CheckCircle2, AlertTriangle, RotateCcw,
} from 'lucide-react'
import PasswordStrengthBar from './PasswordStrengthBar'

// ── Tab button ───────────────────────────────────────────────────────────────
function Tab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 20px',
        fontSize: 13, fontWeight: 600,
        color: active ? 'var(--purple-light)' : 'var(--text-muted)',
        borderBottom: active ? '2px solid var(--purple)' : '2px solid transparent',
        background: 'none', border: 'none', cursor: 'pointer',
        transition: 'var(--transition)',
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

// ── Inline status badge ──────────────────────────────────────────────────────
function StatusBadge({ type, message }) {
  if (!message) return null
  const styles = {
    success: { bg: 'rgba(34,197,94,0.12)', border: '#22c55e', color: '#22c55e', icon: '✅' },
    error:   { bg: 'rgba(239,68,68,0.12)',  border: '#ef4444', color: '#ef4444', icon: '❌' },
    warn:    { bg: 'rgba(234,179,8,0.12)',   border: '#eab308', color: '#eab308', icon: '⚠️' },
    info:    { bg: 'rgba(139,92,246,0.12)',  border: 'var(--purple)', color: 'var(--purple-light)', icon: 'ℹ️' },
  }
  const s = styles[type] || styles.info
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px',
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 'var(--radius-sm)',
      color: s.color, fontSize: 13,
      marginTop: 12,
    }}>
      <span>{s.icon}</span>
      {message}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE BACKUP TAB
// ─────────────────────────────────────────────────────────────────────────────
function CreateBackupTab({ showToast }) {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [destPath,  setDestPath]  = useState('')
  const [status,    setStatus]    = useState(null)   // { type, message }
  const [loading,   setLoading]   = useState(false)

  const isElectron = !!window.electron
  const mismatch   = confirm && password !== confirm
  const tooShort   = password.length > 0 && password.length < 8
  const canSubmit  = password.length >= 8 && password === confirm && destPath && !loading

  async function pickDest() {
    if (!isElectron) return
    const fp = await window.electron.backupSelectDestFile()
    if (fp) setDestPath(fp)
  }

  async function handleCreate() {
    if (!canSubmit) return
    setLoading(true)
    setStatus({ type: 'info', message: 'Encrypting… this may take a few seconds.' })

    try {
      const result = await window.electron.backupCreate(password, destPath)
      if (result.success) {
        const d = new Date(result.manifest?.createdAt).toLocaleString()
        setStatus({ type: 'success', message: `Backup created on ${d}` })
        showToast('Encrypted backup created ✅', 'success')
        setPassword(''); setConfirm(''); setDestPath('')
      } else {
        setStatus({ type: 'error', message: result.error || 'Unknown error' })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Warning */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '12px 14px',
        background: 'rgba(234,179,8,0.08)',
        border: '1px solid rgba(234,179,8,0.3)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
      }}>
        <AlertTriangle size={14} style={{ color: '#eab308', flexShrink: 0, marginTop: 2 }} />
        <span>
          <strong style={{ color: '#eab308' }}>No password recovery.</strong>{' '}
          If you forget your backup password, the data cannot be recovered. Store it somewhere safe.
        </span>
      </div>

      {/* Password */}
      <div className="input-group">
        <label className="input-label">Backup Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw ? 'text' : 'password'}
            className="input"
            placeholder="Choose a strong password…"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ paddingRight: 40 }}
          />
          <button
            onClick={() => setShowPw(v => !v)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 0,
            }}
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <PasswordStrengthBar password={password} />
        {tooShort && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
            Minimum 8 characters required
          </div>
        )}
      </div>

      {/* Confirm */}
      <div className="input-group">
        <label className="input-label">Confirm Password</label>
        <input
          type="password"
          className="input"
          placeholder="Confirm your password…"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          style={{ border: mismatch ? '1px solid #ef4444' : undefined }}
        />
        {mismatch && (
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
            Passwords do not match
          </div>
        )}
      </div>

      {/* Destination */}
      <div className="input-group">
        <label className="input-label">Save Backup To</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Click 📁 to choose a location…"
            value={destPath}
            readOnly
            style={{ flex: 1, cursor: 'default', color: destPath ? 'var(--text-primary)' : 'var(--text-muted)' }}
          />
          <button
            className="btn btn-secondary"
            onClick={pickDest}
            disabled={!isElectron}
            style={{ flexShrink: 0 }}
            title="Choose destination"
          >
            <FolderOpen size={15} />
          </button>
        </div>
        {!isElectron && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            File dialogs require the Electron app (not browser preview)
          </div>
        )}
      </div>

      {/* Create button */}
      <button
        className="btn btn-primary"
        onClick={handleCreate}
        disabled={!canSubmit}
        style={{ alignSelf: 'flex-start', gap: 8 }}
      >
        {loading
          ? <><Loader2 size={15} className="animate-spin" /> Encrypting…</>
          : <><ShieldCheck size={15} /> Create Encrypted Backup</>}
      </button>

      <StatusBadge type={status?.type} message={status?.message} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTORE BACKUP TAB
// ─────────────────────────────────────────────────────────────────────────────
function RestoreBackupTab({ showToast }) {
  const [filePath,  setFilePath]  = useState('')
  const [password,  setPassword]  = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [manifest,  setManifest]  = useState(null)   // verified manifest
  const [status,    setStatus]    = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [confirmed, setConfirmed] = useState(false)  // overwrite warning

  const isElectron = !!window.electron
  const canVerify  = filePath && password.length >= 1 && !verifying && !restoring
  const canRestore = manifest && confirmed && !restoring

  async function pickFile() {
    if (!isElectron) return
    const fp = await window.electron.backupSelectFile()
    if (fp) { setFilePath(fp); setManifest(null); setConfirmed(false); setStatus(null) }
  }

  async function handleVerify() {
    if (!canVerify) return
    setVerifying(true)
    setManifest(null)
    setStatus(null)
    try {
      const result = await window.electron.backupReadManifest(filePath, password)
      if (result.success) {
        setManifest(result.manifest)
        setStatus({ type: 'success', message: 'Password verified — review the backup info below.' })
      } else {
        setStatus({ type: 'error', message: result.error || 'Incorrect password or corrupted file' })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setVerifying(false)
    }
  }

  async function handleRestore() {
    if (!canRestore) return
    setRestoring(true)
    setStatus({ type: 'info', message: 'Decrypting and restoring…' })
    try {
      const result = await window.electron.backupRestore(password, filePath)
      if (result.success) {
        setStatus({ type: 'success', message: 'Restore complete! Please restart the app for changes to take effect.' })
        showToast('Backup restored — please restart the app', 'success')
        setFilePath(''); setPassword(''); setManifest(null); setConfirmed(false)
      } else {
        setStatus({ type: 'error', message: result.error || 'Restore failed' })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* File picker */}
      <div className="input-group">
        <label className="input-label">Backup File (.mfab)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Click 📁 to select a backup file…"
            value={filePath}
            readOnly
            style={{ flex: 1, cursor: 'default', color: filePath ? 'var(--text-primary)' : 'var(--text-muted)' }}
          />
          <button
            className="btn btn-secondary"
            onClick={pickFile}
            disabled={!isElectron}
            style={{ flexShrink: 0 }}
            title="Select backup file"
          >
            <FolderOpen size={15} />
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
              style={{ paddingRight: 40 }}
            />
            <button
              onClick={() => setShowPw(v => !v)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 0,
              }}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleVerify}
            disabled={!canVerify}
            style={{ flexShrink: 0 }}
          >
            {verifying ? <Loader2 size={14} className="animate-spin" /> : 'Verify'}
          </button>
        </div>
      </div>

      <StatusBadge type={status?.type} message={status?.message} />

      {/* Manifest info */}
      {manifest && (
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg-base)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            Backup Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '4px 0', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Created</span>
            <span>{new Date(manifest.createdAt).toLocaleString()}</span>
            <span style={{ color: 'var(--text-muted)' }}>App Version</span>
            <span>v{manifest.appVersion}</span>
            <span style={{ color: 'var(--text-muted)' }}>Platform</span>
            <span>{manifest.platform}</span>
          </div>
        </div>
      )}

      {/* Overwrite warning + confirm */}
      {manifest && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
            <AlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
            <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: '#ef4444' }}>This will overwrite</strong> your current settings
              and history with the data from this backup. This cannot be undone.
            </span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              style={{ accentColor: 'var(--purple)', width: 14, height: 14 }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>I understand and want to proceed</span>
          </label>
        </div>
      )}

      {/* Restore button */}
      {manifest && (
        <button
          className="btn btn-primary"
          onClick={handleRestore}
          disabled={!canRestore}
          style={{ alignSelf: 'flex-start', gap: 8, background: confirmed ? undefined : 'var(--bg-elevated)' }}
        >
          {restoring
            ? <><Loader2 size={15} className="animate-spin" /> Restoring…</>
            : <><RotateCcw size={15} /> Restore Backup</>}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function BackupPanel({ showToast }) {
  const [tab, setTab] = useState('create')

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      {/* Card header */}
      <div className="card-title mb-4" style={{ marginBottom: 0 }}>
        <ShieldCheck size={16} style={{ color: 'var(--purple)' }} />
        Backup & Restore
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        Create an encrypted backup of your settings and history, or restore from a previous backup.
        Backups are encrypted with AES-256-GCM and a password you choose.
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: 24,
      }}>
        <Tab
          active={tab === 'create'}
          onClick={() => setTab('create')}
          icon={ShieldCheck}
          label="Create Backup"
        />
        <Tab
          active={tab === 'restore'}
          onClick={() => setTab('restore')}
          icon={ShieldOff}
          label="Restore Backup"
        />
      </div>

      {tab === 'create'  && <CreateBackupTab  showToast={showToast} />}
      {tab === 'restore' && <RestoreBackupTab showToast={showToast} />}
    </div>
  )
}
