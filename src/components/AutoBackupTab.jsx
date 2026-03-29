import { useState, useEffect, useCallback } from 'react'
import {
  Clock, FolderOpen, Plus, X, Play, Loader2,
  Eye, EyeOff, AlertTriangle, CheckCircle2, ShieldCheck,
  Calendar, ToggleLeft, ToggleRight,
} from 'lucide-react'
import PasswordStrengthBar from './PasswordStrengthBar'

const isElectron = !!window.electron

function formatDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}

function Badge({ type, children }) {
  const s = {
    success: { bg: 'rgba(34,197,94,0.1)',  border: '#22c55e', color: '#22c55e' },
    error:   { bg: 'rgba(239,68,68,0.1)',  border: '#ef4444', color: '#ef4444' },
    info:    { bg: 'rgba(139,92,246,0.1)', border: 'var(--purple)', color: 'var(--purple-light)' },
    warn:    { bg: 'rgba(234,179,8,0.1)',  border: '#eab308', color: '#eab308' },
  }[type] || {}
  return (
    <div style={{
      padding: '9px 14px', borderRadius: 'var(--radius-sm)',
      background: s.bg, border: `1px solid ${s.border}`,
      color: s.color, fontSize: 13, lineHeight: 1.5,
    }}>
      {children}
    </div>
  )
}

function Toggle({ value, onChange, label, disabled }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: disabled ? 'default' : 'pointer', userSelect: 'none' }}>
      <div
        onClick={() => !disabled && onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 99, flexShrink: 0,
          background: value ? 'var(--purple)' : 'var(--border)',
          position: 'relative', transition: 'background 0.2s',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 23 : 3,
          width: 18, height: 18, borderRadius: '50%', background: 'white',
          transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </div>
      {label && <span style={{ fontSize: 14, color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 500 }}>{label}</span>}
    </label>
  )
}

const SCHEDULES = [
  { value: 'hourly', label: 'Every Hour' },
  { value: 'daily',  label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`
  return { value: i, label: h }
})

export default function AutoBackupTab({ showToast }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [config,   setConfig]   = useState(null)
  const [encAvail, setEncAvail] = useState(false)
  const [hasPw,    setHasPw]    = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [running,  setRunning]  = useState(false)

  // password fields (only when usePassword is being enabled)
  const [showPw,   setShowPw]   = useState(false)
  const [pwField,  setPwField]  = useState('')
  const [pwDirty,  setPwDirty]  = useState(false)

  const [status,   setStatus]   = useState(null)   // { type, message }
  const [progress, setProgress] = useState(null)

  const DEFAULT_CONFIG = {
    enabled: false, sourcePaths: [], destFolder: '',
    schedule: 'daily', hour: 2, dayOfWeek: 0,
    usePassword: false, lastRun: null, lastStatus: null, lastError: null, lastFile: null,
  }

  // ── Load config on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isElectron) {
      setConfig(DEFAULT_CONFIG)
      setLoading(false)
      return
    }
    window.electron.autoBkpGetConfig()
      .then(res => {
        setConfig(res.config || DEFAULT_CONFIG)
        setEncAvail(res.encryptionAvailable || false)
        setHasPw(res.hasPassword || false)
      })
      .catch(() => setConfig(DEFAULT_CONFIG))
      .finally(() => setLoading(false))

    const unsubProgress = window.electron.onAutoBkpProgress(prog => setProgress(prog))
    const unsubStatus   = window.electron.onAutoBkpStatus(data => {
      setStatus(data.status === 'success'
        ? { type: 'success', message: `✅ Auto-backup succeeded · ${formatDate(data.lastRun)}` }
        : { type: 'error',   message: `❌ ${data.error}` }
      )
      setRunning(false)
    })
    return () => { unsubProgress(); unsubStatus() }
  }, [])

  const patch = (partial) => setConfig(prev => ({ ...prev, ...partial }))

  // ── Source management ──────────────────────────────────────────────────────
  async function addSources() {
    if (!isElectron) return
    const paths = await window.electron.autoBkpSelectSources()
    if (paths?.length) patch({ sourcePaths: [...new Set([...(config.sourcePaths || []), ...paths])] })
  }

  function removeSource(p) { patch({ sourcePaths: config.sourcePaths.filter(s => s !== p) }) }

  async function pickDest() {
    if (!isElectron) return
    const fp = await window.electron.autoBkpSelectDestFolder()
    if (fp) patch({ destFolder: fp })
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!isElectron || !config) return
    setSaving(true)
    setStatus(null)

    try {
      // Save password if dirty
      if (pwDirty && config.usePassword && encAvail) {
        if (pwField) {
          await window.electron.autoBkpSavePassword(pwField)
          setHasPw(true)
        } else {
          await window.electron.autoBkpDeletePassword()
          setHasPw(false)
        }
        setPwDirty(false)
        setPwField('')
      }

      // If usePassword was turned off, delete stored pw
      if (!config.usePassword && hasPw) {
        await window.electron.autoBkpDeletePassword()
        setHasPw(false)
      }

      await window.electron.autoBkpSetConfig(config)
      setStatus({ type: 'success', message: 'Settings saved. Scheduler is active.' })
      showToast?.('Auto-backup settings saved', 'success')
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    }
    setSaving(false)
  }

  // ── Run Now ────────────────────────────────────────────────────────────────
  async function handleRunNow() {
    if (!isElectron || running) return
    setRunning(true); setStatus(null); setProgress(null)
    const result = await window.electron.autoBkpRunNow()
    if (result.success) {
      setStatus({ type: 'success', message: `✅ Backup complete · ${result.config?.lastFile || ''}` })
      setConfig(result.config)
      showToast?.('Auto-backup ran successfully', 'success')
    } else {
      setStatus({ type: 'error', message: result.error })
    }
    setProgress(null)
    setRunning(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
      <Loader2 size={16} className="animate-spin" /> Loading settings…
    </div>
  )

  if (!config) return null

  const needsConfig   = !config.sourcePaths?.length || !config.destFolder
  const canRunNow     = !needsConfig && !running
  const showDayPicker = config.schedule === 'weekly'
  const showHourPicker = config.schedule === 'daily' || config.schedule === 'weekly'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Enable toggle — hero row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        background: config.enabled ? 'rgba(139,92,246,0.08)' : 'var(--bg-base)',
        border: `1px solid ${config.enabled ? 'var(--purple)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        transition: 'all 0.2s',
      }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>Scheduled Auto-Backup</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {config.enabled ? '🟢 Active — running in the background' : '⚪ Disabled'}
          </div>
        </div>
        <Toggle value={config.enabled} onChange={v => patch({ enabled: v })} />
      </div>

      {/* Source folders */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label className="input-label" style={{ marginBottom: 0 }}>Source Folders</label>
          <button className="btn btn-secondary" onClick={addSources} disabled={!isElectron}
            style={{ fontSize: 12, padding: '4px 10px', gap: 5 }}>
            <Plus size={12} /> Add
          </button>
        </div>

        {!config.sourcePaths?.length ? (
          <div onClick={addSources} style={{
            border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)',
            padding: '18px', textAlign: 'center', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 12,
          }}>
            Click to add source folders to back up automatically
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {config.sourcePaths.map(src => (
              <div key={src} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', background: 'var(--bg-base)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12,
              }}>
                <FolderOpen size={12} style={{ color: 'var(--purple)', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src}</span>
                <button onClick={() => removeSource(src)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Destination */}
      <div className="input-group">
        <label className="input-label">Backup Destination Folder</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" readOnly value={config.destFolder}
            placeholder="Click 📁 to choose where backups are saved…"
            style={{ flex: 1, cursor: 'default', color: config.destFolder ? 'var(--text-primary)' : 'var(--text-muted)' }} />
          <button className="btn btn-secondary" onClick={pickDest} style={{ flexShrink: 0 }}>
            <FolderOpen size={14} />
          </button>
        </div>
      </div>

      {/* Schedule */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="input-label">Schedule</label>
          <select className="input" value={config.schedule} onChange={e => patch({ schedule: e.target.value })}>
            {SCHEDULES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {showHourPicker && (
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Time of Day</label>
            <select className="input" value={config.hour} onChange={e => patch({ hour: Number(e.target.value) })}>
              {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
        )}

        {showDayPicker && (
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Day of Week</label>
            <select className="input" value={config.dayOfWeek} onChange={e => patch({ dayOfWeek: Number(e.target.value) })}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Encryption */}
      {encAvail ? (
        <div style={{ padding: '14px 16px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          <Toggle
            value={config.usePassword}
            onChange={v => patch({ usePassword: v })}
            label="Encrypt backups with password"
          />

          {config.usePassword && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="input-label" style={{ marginBottom: 2 }}>
                {hasPw && !pwDirty ? '🔒 Password saved — enter a new one to change' : 'Encryption Password'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="input"
                  placeholder={hasPw ? '(unchanged)' : 'Set a strong password…'}
                  value={pwField}
                  onChange={e => { setPwField(e.target.value); setPwDirty(true) }}
                  style={{ paddingRight: 36 }}
                />
                <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {pwDirty && pwField && <PasswordStrengthBar password={pwField} />}
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Password is stored securely in the OS keychain — it will never appear in plain text.
              </div>
            </div>
          )}
        </div>
      ) : (
        <Badge type="warn">
          🔓 OS-level encryption is unavailable on this system. Auto-backups will be saved as unencrypted .zip files.
          You can still protect them with manual backups from the "Create Backup" tab.
        </Badge>
      )}

      {/* Last run status */}
      {config.lastRun && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
          padding: '12px 16px', background: 'var(--bg-base)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          fontSize: 12,
        }}>
          {[
            ['Last Run',   formatDate(config.lastRun)],
            ['Status',     config.lastStatus === 'success' ? '✅ Success' : config.lastStatus === 'error' ? '❌ Error' : '—'],
            ['Last File',  config.lastFile ? config.lastFile.split(/[\\/]/).pop() : '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>{k}</div>
              <div style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{v}</div>
            </div>
          ))}
          {config.lastError && (
            <div style={{ gridColumn: '1/-1', color: '#ef4444', marginTop: 4 }}>
              Error: {config.lastError}
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {progress && running && (
        <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: progress.percent ? `${progress.percent}%` : '30%',
            background: 'linear-gradient(90deg, var(--purple), var(--cyan))',
            borderRadius: 99,
            animation: progress.percent ? 'none' : 'pulse 1.5s infinite',
            transition: 'width 0.3s',
          }} />
        </div>
      )}

      {status && <Badge type={status.type}>{status.message}</Badge>}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={!isElectron || saving}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : '💾 Save Settings'}
        </button>
        <button className="btn btn-secondary" onClick={handleRunNow} disabled={!isElectron || !canRunNow || running}>
          {running
            ? <><Loader2 size={14} className="animate-spin" /> Running…</>
            : <><Play size={14} /> Run Backup Now</>}
        </button>
      </div>

      {needsConfig && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          ⚠️ Add at least one source folder and a destination before enabling the scheduler.
        </div>
      )}
    </div>
  )
}
