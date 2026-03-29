import { useState } from 'react'
import { FolderOpen, ChevronRight, FolderSearch, Loader2, RefreshCw } from 'lucide-react'

export default function FolderPicker({ onFolderScanned, onScanStart, initialPath = '' }) {
  const [selectedPath, setSelectedPath] = useState(initialPath)
  const [scanning, setScanning] = useState(false)
  const [recursive, setRecursive] = useState(true)
  const [error, setError] = useState('')

  const isElectron = !!window.electron

  async function handleSelectFolder() {
    if (!isElectron) return
    const folderPath = await window.electron.selectFolder()
    if (folderPath) setSelectedPath(folderPath)
  }

  async function handleScan() {
    if (!selectedPath) return
    setScanning(true)
    setError('')
    onScanStart?.()

    const result = await window.electron.scanFolder(selectedPath, recursive)

    setScanning(false)
    if (result.success) {
      onFolderScanned(selectedPath, result.data)
    } else {
      setError(result.error || 'Failed to scan folder')
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <h2>File Organizer</h2>
        <p>Select a folder, scan its contents, then let AI organize everything for you.</p>
      </div>

      <div className="page-body">
        {/* Drop zone */}
        <div
          className="folder-drop-zone mb-6"
          onClick={handleSelectFolder}
          style={{ cursor: isElectron ? 'pointer' : 'default' }}
        >
          <div className="folder-drop-zone-icon">
            <FolderSearch size={36} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              {selectedPath || 'Click to Select a Folder'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {selectedPath
                ? 'Click to choose a different folder'
                : 'Choose the folder you want to organize with AI'}
            </div>
          </div>
          {selectedPath && (
            <div className="chip chip-purple">
              <FolderOpen size={12} />
              {selectedPath.split('\\').pop() || selectedPath.split('/').pop()}
            </div>
          )}
        </div>

        {/* Options */}
        <div className="card mb-6">
          <div className="card-title" style={{ marginBottom: 16 }}>Scan Options</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div
              onClick={() => setRecursive(!recursive)}
              style={{
                width: 40, height: 22, borderRadius: 99,
                background: recursive ? 'var(--purple)' : 'var(--bg-base)',
                border: '1px solid var(--border)',
                position: 'relative', transition: 'var(--transition)', cursor: 'pointer',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 50, background: 'white',
                position: 'absolute', top: 2,
                left: recursive ? 20 : 2,
                transition: 'var(--transition)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Scan Subfolders</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Include files in nested subdirectories (up to 5 levels deep)
              </div>
            </div>
          </label>
        </div>

        {error && (
          <div className="toast error" style={{ marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Action */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn btn-secondary"
            onClick={handleSelectFolder}
            disabled={!isElectron}
          >
            <FolderOpen size={15} />
            Browse…
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleScan}
            disabled={!selectedPath || scanning}
          >
            {scanning ? (
              <><Loader2 size={16} className="animate-spin" /> Scanning…</>
            ) : (
              <><FolderSearch size={16} /> Scan Folder</>
            )}
          </button>
        </div>

        {!isElectron && (
          <div className="card mt-4" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
            <div style={{ fontSize: 13, color: 'var(--amber)', display: 'flex', gap: 8 }}>
              ⚠️ <span>Running in browser mode. Launch with <code>npm run electron:dev</code> to access your files.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
