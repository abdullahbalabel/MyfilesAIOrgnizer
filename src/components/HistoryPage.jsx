import { useState, useEffect } from 'react'
import { History as HistoryIcon, RotateCcw, Loader2, FolderOpen, Calendar, File } from 'lucide-react'

export default function HistoryPage({ showToast }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [undoing, setUndoing] = useState(null)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setLoading(true)
    if (window.electron) {
      const data = await window.electron.loadHistory()
      setHistory(data || [])
    }
    setLoading(false)
  }

  async function handleUndo(operationId) {
    setUndoing(operationId)
    const result = await window.electron.undo(operationId)
    setUndoing(null)
    if (result.success) {
      showToast('Operation undone successfully!', 'success')
      loadHistory()
    } else {
      showToast('Undo failed: ' + result.error, 'error')
    }
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <h2>History</h2>
        <p>View past organization operations and undo them if needed.</p>
      </div>
      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--purple)' }} />
          </div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><HistoryIcon size={32} /></div>
            <h3>No History Yet</h3>
            <p>Organization operations will appear here. You can undo any of them.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {history.map((op, i) => (
              <div key={op.id} className="card card-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--purple)', flexShrink: 0,
                    }}>
                      <FolderOpen size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                        Organized {op.count} files
                        {i === 0 && <span className="chip chip-purple" style={{ marginLeft: 8, fontSize: 10 }}>Latest</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} />
                          {new Date(op.date).toLocaleString()}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <File size={11} />
                          {op.count} files moved
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleUndo(op.id)}
                    disabled={!!undoing}
                  >
                    {undoing === op.id
                      ? <><Loader2 size={13} className="animate-spin" /> Undoing…</>
                      : <><RotateCcw size={13} /> Undo</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
