import { useState, useMemo } from 'react'
import {
  FolderOpen, ChevronRight, ChevronDown, CheckCircle2,
  Loader2, AlertTriangle, RotateCcw, Pencil,
  FolderCheck, ArrowRightLeft, FolderInput, Trash2,
} from 'lucide-react'

export default function OrganizePlan({ analyzedFiles, folderPath, onExecuted, showToast }) {
  const [executing, setExecuting] = useState(false)
  const [done, setDone] = useState(null)
  const [editedPlan, setEditedPlan] = useState(null)
  const [openFolders, setOpenFolders] = useState(new Set())

  // New options
  const [destFolder, setDestFolder] = useState(folderPath) // default: same as source
  const [deleteEmpty, setDeleteEmpty] = useState(false)

  const plan = useMemo(() => {
    const source = editedPlan || analyzedFiles
    const map = {}
    source.forEach((f) => {
      const folder = f.suggestedFolder || 'Other'
      if (!map[folder]) map[folder] = []
      map[folder].push(f)
    })
    return map
  }, [analyzedFiles, editedPlan])

  const folderNames = Object.keys(plan).sort()
  const totalFiles = analyzedFiles.length

  function toggleFolder(name) {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function changeFolder(fileId, newFolder) {
    const base = editedPlan || analyzedFiles
    setEditedPlan(base.map((f) => f.id === fileId ? { ...f, suggestedFolder: newFolder } : f))
  }

  async function handlePickDest() {
    if (!window.electron) return
    const picked = await window.electron.selectDestFolder()
    if (picked) setDestFolder(picked)
  }

  async function handleExecute() {
    if (!window.electron) { showToast('Electron required to move files', 'error'); return }
    setExecuting(true)

    const planArray = (editedPlan || analyzedFiles).map((f) => ({
      originalPath: f.originalPath || f.path,
      suggestedFolder: f.suggestedFolder,
      name: f.name,
    }))

    // Move files to destination
    const result = await window.electron.executeOrganize(planArray, destFolder)

    if (!result.success) {
      setExecuting(false)
      showToast('Failed: ' + result.error, 'error')
      return
    }

    // Optionally delete empty folders from the SOURCE
    let deletedCount = 0
    if (deleteEmpty) {
      const delResult = await window.electron.deleteEmptyFolders(folderPath)
      if (delResult.success) deletedCount = delResult.deleted
    }

    setExecuting(false)
    const msg = deletedCount > 0
      ? `✅ Organized ${result.data.count} files · Removed ${deletedCount} empty folders`
      : `✅ Organized ${result.data.count} files successfully!`
    setDone({ ...result.data, deletedFolders: deletedCount })
    onExecuted(result.data)
    showToast(msg, 'success')
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="page-header" style={{ flexShrink: 0 }}>
          <h2>Organization Complete!</h2>
          <p>All files have been moved to their new locations.</p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          <div className="empty-state">
            <div className="empty-state-icon" style={{
              background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)',
              color: 'var(--green)', width: 100, height: 100, borderRadius: 30,
            }}>
              <CheckCircle2 size={48} />
            </div>
            <h3>{done.count} Files Organized</h3>
            {done.deletedFolders > 0 && (
              <p style={{ color: 'var(--amber)' }}>🗑️ {done.deletedFolders} empty folders removed</p>
            )}
            <p>Check the History page to undo if needed.</p>
            <button className="btn btn-primary" onClick={() => { setDone(null); setEditedPlan(null) }}>
              Organize Another Folder
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isSameFolder = destFolder === folderPath

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Fixed header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Organization Plan</h2>
            <p>{totalFiles} files → {folderNames.length} folders &nbsp;·&nbsp; Review before executing</p>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary" onClick={() => setEditedPlan(null)}>
              <RotateCcw size={14} /> Reset
            </button>
            <button className="btn btn-primary" onClick={handleExecute} disabled={executing}>
              {executing
                ? <><Loader2 size={14} className="animate-spin" /> Moving files…</>
                : <><FolderCheck size={14} /> Execute Plan</>}
            </button>
          </div>
        </div>
      </div>

      {/* Fixed options bar */}
      <div style={{
        padding: '10px 32px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(15,15,30,0.5)',
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        flexShrink: 0,
      }}>
        {/* Summary chips */}
        <div className="chip chip-purple">
          <FolderOpen size={11} /> {folderNames.length} folders
        </div>
        <div className="chip chip-cyan">
          <ArrowRightLeft size={11} /> {totalFiles} files
        </div>
        {editedPlan && (
          <div className="chip chip-amber"><Pencil size={11} /> Custom edits</div>
        )}

        <div style={{ flex: 1 }} />

        {/* Destination picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FolderInput size={14} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Destination:</span>
          <span style={{
            fontSize: 12, color: isSameFolder ? 'var(--text-muted)' : 'var(--cyan)',
            maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={destFolder}>
            {isSameFolder ? 'Same as source' : destFolder}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handlePickDest}>
            Change…
          </button>
          {!isSameFolder && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setDestFolder(folderPath)}
              title="Reset to source folder"
              style={{ fontSize: 11, color: 'var(--text-muted)' }}
            >
              ✕ Reset
            </button>
          )}
        </div>

        {/* Delete empty folders toggle */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          onClick={() => setDeleteEmpty((v) => !v)}
        >
          <div style={{
            width: 36, height: 20, borderRadius: 99,
            background: deleteEmpty ? 'var(--red)' : 'var(--bg-base)',
            border: '1px solid var(--border)',
            position: 'relative', transition: 'var(--transition)', flexShrink: 0,
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: 50, background: 'white',
              position: 'absolute', top: 2,
              left: deleteEmpty ? 18 : 2,
              transition: 'var(--transition)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }} />
          </div>
          <Trash2 size={13} style={{ color: deleteEmpty ? 'var(--red)' : 'var(--text-muted)' }} />
          <span style={{ fontSize: 12, color: deleteEmpty ? 'var(--red)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Delete empty folders
          </span>
        </div>
      </div>

      {/* Scrollable tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px 24px' }}>

        {/* Destination info card (if different) */}
        {!isSameFolder && (
          <div className="card mb-4" style={{ borderColor: 'rgba(6,182,212,0.4)', padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <FolderInput size={15} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Files will be organized into: </span>
                <strong style={{ color: 'var(--cyan)' }}>{destFolder}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Delete warning */}
        {deleteEmpty && (
          <div className="card mb-4" style={{ borderColor: 'rgba(239,68,68,0.4)', padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <Trash2 size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <div style={{ color: 'var(--text-secondary)' }}>
                Empty folders in <strong style={{ color: 'var(--red)' }}>{folderPath}</strong> will be permanently deleted after moving.
              </div>
            </div>
          </div>
        )}

        {/* Folder tree */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            <FolderOpen size={16} style={{ color: 'var(--purple)' }} />
            Proposed Folder Structure
          </div>
          <div className="plan-tree">
            {folderNames.map((folderName) => {
              const filesInFolder = plan[folderName]
              const isOpen = openFolders.has(folderName)
              const parts = folderName.split('/')
              return (
                <div key={folderName} style={{ marginBottom: 2 }}>
                  <div
                    className="plan-folder"
                    onClick={() => toggleFolder(folderName)}
                    style={{ background: isOpen ? 'var(--bg-card-hover)' : '' }}
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <FolderOpen size={14} style={{ color: 'var(--amber)' }} />
                    <span style={{ flex: 1 }}>
                      {parts.map((p, i) => (
                        <span key={i}>
                          {i > 0 && <span style={{ color: 'var(--text-muted)' }}> / </span>}
                          <span style={{ color: i === parts.length - 1 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{p}</span>
                        </span>
                      ))}
                    </span>
                    <span className="chip chip-gray">{filesInFolder.length} files</span>
                  </div>

                  {isOpen && filesInFolder.map((file) => (
                    <div key={file.id} className="plan-file">
                      <span className="truncate" style={{ maxWidth: 340 }}>{file.name}</span>
                      <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                        <span className="chip chip-gray">{file.sizeFormatted}</span>
                        {file.confidence && (
                          <span
                            className={`chip ${file.confidence > 0.85 ? 'chip-green' : file.confidence > 0.65 ? 'chip-amber' : 'chip-red'}`}
                            title={file.reason}
                          >
                            {Math.round(file.confidence * 100)}%
                          </span>
                        )}
                        <select
                          className="input"
                          style={{ padding: '2px 8px', height: 26, fontSize: 11, width: 'auto', minWidth: 140 }}
                          value={file.suggestedFolder}
                          onChange={(e) => changeFolder(file.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {folderNames.map((fn) => (
                            <option key={fn} value={fn}>{fn}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        {/* Warning */}
        <div className="card" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--amber)' }}>Review carefully before executing.</strong> Files will be
              moved to <code style={{ color: 'var(--cyan)' }}>{destFolder}</code>.
              You can undo from the <strong>History</strong> page.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
