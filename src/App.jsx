import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import FolderPicker from './components/FolderPicker'
import FileScanner from './components/FileScanner'
import OrganizePlan from './components/OrganizePlan'
import Dashboard from './components/Dashboard'
import Settings from './components/Settings'
import HistoryPage from './components/HistoryPage'
import ConsoleBar from './components/ConsoleBar'
import { LoggerProvider, useLogger } from './contexts/LoggerContext'
import { Minus, Square, X } from 'lucide-react'

// ─── Persistence helpers ──────────────────────────────
const LS = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  },
  del: (key) => { try { localStorage.removeItem(key) } catch {} },
}

// ─── Toast System ─────────────────────────────────────
function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}</span>
          {t.message}
        </div>
      ))}
    </div>
  )
}

// ─── Titlebar ─────────────────────────────────────────
function Titlebar() {
  const isElectron = !!window.electron
  return (
    <div className="titlebar">
      <div className="titlebar-title">
        <div className="dot" />
        MyFiles AI Organizer
      </div>
      {isElectron && (
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={() => window.electron.minimize()} title="Minimize">
            <Minus size={11} />
          </button>
          <button className="titlebar-btn" onClick={() => window.electron.maximize()} title="Maximize">
            <Square size={10} />
          </button>
          <button className="titlebar-btn close" onClick={() => window.electron.close()} title="Close">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Organizer Flow ───────────────────────────────────
function OrganizerView({ apiKey, customRules, showToast, onFilesScanned }) {
  // Restore persisted state on mount
  const saved = LS.get('myfiles-organizer-state', {})
  const [step, setStep] = useState(saved.step || 'pick')
  const [folderPath, setFolderPath] = useState(saved.folderPath || '')
  const [scannedFiles, setScannedFiles] = useState(saved.scannedFiles || [])
  const [analyzedFiles, setAnalyzedFiles] = useState(saved.analyzedFiles || [])

  // Restore parent dashboard data
  useEffect(() => {
    if (saved.scannedFiles?.length) onFilesScanned?.(saved.scannedFiles)
  }, []) // eslint-disable-line

  // Persist state on every change
  useEffect(() => {
    if (!folderPath && step === 'pick') {
      LS.del('myfiles-organizer-state')
      return
    }
    try {
      LS.set('myfiles-organizer-state', {
        step,
        folderPath,
        // Cap at 3000 files to stay within localStorage limits (~5MB)
        scannedFiles: scannedFiles.slice(0, 3000),
        analyzedFiles: analyzedFiles.slice(0, 3000),
      })
    } catch {
      // Storage quota exceeded — save minimal state
      LS.set('myfiles-organizer-state', { step, folderPath, scannedFiles: [], analyzedFiles: [] })
    }
  }, [step, folderPath, scannedFiles, analyzedFiles])

  function handleFolderScanned(path, files) {
    setFolderPath(path)
    setScannedFiles(files)
    setAnalyzedFiles([])
    onFilesScanned?.(files)
    setStep('scan')
  }

  function handleAnalyzed(files) {
    setAnalyzedFiles(files)
    setStep('plan')
  }

  function handleReset() {
    setStep('pick')
    setFolderPath('')
    setScannedFiles([])
    setAnalyzedFiles([])
    onFilesScanned?.([])
    LS.del('myfiles-organizer-state')
  }

  const steps = [
    { id: 'pick', label: '① Select' },
    { id: 'scan', label: '② Scan & Analyze' },
    { id: 'plan', label: '③ Review & Execute' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Step breadcrumb */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(15,15,30,0.5)',
        padding: '0 32px',
        paddingTop: 36,
      }}>
        {steps.map((s) => (
          <div
            key={s.id}
            style={{
              padding: '10px 20px',
              fontSize: 12, fontWeight: 600,
              color: s.id === step ? 'var(--purple-light)' : 'var(--text-muted)',
              borderBottom: s.id === step ? '2px solid var(--purple)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'var(--transition)',
            }}
            onClick={() => {
              if (s.id === 'pick') handleReset()
              if (s.id === 'scan' && scannedFiles.length > 0) setStep('scan')
              if (s.id === 'plan' && analyzedFiles.length > 0) setStep('plan')
            }}
          >
            {s.label}
            {s.id === 'scan' && scannedFiles.length > 0 && step !== 'pick' && (
              <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--purple)', fontWeight: 700 }}>
                ({scannedFiles.length})
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: 0 }}>
        {step === 'pick' && (
          <FolderPicker
            initialPath={folderPath}
            onFolderScanned={handleFolderScanned}
            onScanStart={() => {}}
          />
        )}
        {step === 'scan' && (
          <FileScanner
            files={scannedFiles}
            folderPath={folderPath}
            apiKey={apiKey}
            customRules={customRules}
            onAnalyzed={handleAnalyzed}
            showToast={showToast}
          />
        )}
        {step === 'plan' && (
          <OrganizePlan
            analyzedFiles={analyzedFiles}
            folderPath={folderPath}
            onExecuted={() => {}}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────
function AppInner() {
  const [activePage, setActivePage] = useState(() => LS.get('myfiles-active-page', 'organizer'))
  const [scannedFiles, setScannedFiles] = useState([])
  const [settings, setSettings] = useState({ apiKey: '', customRules: '' })
  const [toasts, setToasts] = useState([])
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const { addLog } = useLogger()

  // Load settings on mount — localStorage first (instant), then Electron IPC (authoritative)
  useEffect(() => {
    const local = LS.get('myfiles-settings', {})
    if (Object.keys(local).length > 0) {
      setSettings((s) => ({ ...s, ...local }))
    }
    async function loadFromElectron() {
      if (window.electron) {
        const saved = await window.electron.loadSettings()
        if (saved && Object.keys(saved).length > 0) {
          setSettings((s) => ({ ...s, ...saved }))
          LS.set('myfiles-settings', { ...local, ...saved })
        }
      }
      setSettingsLoaded(true)
      addLog('App initialized, settings loaded', 'info', 'App')
    }
    loadFromElectron()
  }, []) // eslint-disable-line

  // Persist active page
  useEffect(() => {
    LS.set('myfiles-active-page', activePage)
  }, [activePage])

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
    // Mirror toasts to the console bar
    addLog(message, type === 'info' ? 'info' : type, 'App')
  }, [addLog])

  async function handleSaveSettings(newSettings) {
    setSettings(newSettings)
    LS.set('myfiles-settings', newSettings)
    if (window.electron) {
      const ok = await window.electron.saveSettings(newSettings)
      addLog(ok ? 'Settings saved to disk' : 'Settings saved to localStorage only', ok ? 'success' : 'warn', 'App')
      if (!ok) showToast('Warning: Could not save to disk. Settings saved locally.', 'info')
    }
  }

  return (
    <div className="app-layout" style={{ paddingBottom: 29 /* console bar tab height */ }}>
      <Titlebar />
      <Sidebar
        active={activePage}
        setActive={setActivePage}
        fileCounts={{ scanned: scannedFiles.length }}
      />
      <main className="main-content" style={{ paddingTop: 0 }}>
        {activePage === 'organizer' && settingsLoaded && (
          <OrganizerView
            apiKey={settings.apiKey}
            customRules={settings.customRules}
            showToast={showToast}
            onFilesScanned={setScannedFiles}
          />
        )}
        {activePage === 'organizer' && !settingsLoaded && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
          </div>
        )}
        {activePage === 'dashboard' && <Dashboard files={scannedFiles} />}
        {activePage === 'history' && <HistoryPage showToast={showToast} />}
        {activePage === 'settings' && (
          <Settings settings={settings} onSave={handleSaveSettings} showToast={showToast} />
        )}
      </main>
      <ToastContainer toasts={toasts} />
      <ConsoleBar />
    </div>
  )
}

export default function App() {
  return (
    <LoggerProvider>
      <AppInner />
    </LoggerProvider>
  )
}

