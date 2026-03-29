import { useState, useEffect, useRef } from 'react'
import { useLogger } from '../contexts/LoggerContext'
import {
  ChevronUp, ChevronDown, Terminal, Trash2, Download,
  Info, CheckCircle2, XCircle, AlertTriangle, Sparkles, HardDrive,
} from 'lucide-react'

const TYPE_CONFIG = {
  info:    { color: 'var(--text-secondary)', icon: Info,          label: 'INFO',    bg: 'transparent' },
  success: { color: 'var(--green)',          icon: CheckCircle2,  label: 'OK',      bg: 'rgba(16,185,129,0.05)' },
  error:   { color: 'var(--red)',            icon: XCircle,       label: 'ERROR',   bg: 'rgba(239,68,68,0.07)' },
  warn:    { color: 'var(--amber)',          icon: AlertTriangle, label: 'WARN',    bg: 'rgba(245,158,11,0.05)' },
  ai:      { color: 'var(--purple-light)',   icon: Sparkles,      label: 'AI',      bg: 'rgba(139,92,246,0.05)' },
  fs:      { color: 'var(--cyan)',           icon: HardDrive,     label: 'FS',      bg: 'rgba(6,182,212,0.05)'  },
}

const FILTERS = ['all', 'ai', 'fs', 'success', 'error', 'warn', 'info']

export default function ConsoleBar() {
  const { logs, clearLogs } = useLogger()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [height, setHeight] = useState(240)
  const [dragging, setDragging] = useState(false)
  const logEndRef = useRef(null)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.type === filter)
  const errorCount = logs.filter((l) => l.type === 'error').length
  const aiCount = logs.filter((l) => l.type === 'ai').length

  // Auto-scroll to bottom on new logs (only when open)
  useEffect(() => {
    if (open) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, open])

  // Open automatically on error
  useEffect(() => {
    if (logs.length > 0 && logs[logs.length - 1].type === 'error') setOpen(true)
  }, [logs])

  // Drag-to-resize
  function startDrag(e) {
    e.preventDefault()
    dragStartY.current = e.clientY
    dragStartH.current = height
    setDragging(true)
    function onMove(ev) {
      const delta = dragStartY.current - ev.clientY
      setHeight(Math.max(120, Math.min(600, dragStartH.current + delta)))
    }
    function onUp() {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function exportLogs() {
    const text = logs.map((l) =>
      `[${l.time}] [${l.type.toUpperCase()}] [${l.source}] ${l.message}`
    ).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `myfiles-log-${Date.now()}.txt`
    a.click()
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 220, right: 0,
      zIndex: 100,
      boxShadow: open ? '0 -4px 30px rgba(0,0,0,0.5)' : 'none',
      transition: 'box-shadow 0.2s',
    }}>
      {/* Drag handle (only when open) */}
      {open && (
        <div
          onMouseDown={startDrag}
          style={{
            height: 5, cursor: 'ns-resize',
            background: dragging ? 'var(--purple)' : 'var(--border)',
            transition: 'background 0.15s',
          }}
        />
      )}

      {/* Header tab */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 16px',
          background: 'rgba(15,15,28,0.97)',
          borderTop: '1px solid var(--border)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Terminal size={13} style={{ color: 'var(--purple)' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>
          Console
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
            {logs.length} entries
          </span>
        </span>

        {/* Badge counts */}
        {errorCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: 'var(--red)', color: 'white',
            padding: '1px 5px', borderRadius: 99,
          }}>
            {errorCount} error{errorCount > 1 ? 's' : ''}
          </span>
        )}
        {aiCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: 'rgba(139,92,246,0.3)', color: 'var(--purple-light)',
            padding: '1px 5px', borderRadius: 99,
          }}>
            {aiCount} AI
          </span>
        )}

        {/* Actions (stop click propagation so they don't toggle the bar) */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 4 }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={exportLogs}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
            title="Export logs as .txt"
          >
            <Download size={12} />
          </button>
          <button
            onClick={clearLogs}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
            title="Clear logs"
          >
            <Trash2 size={12} />
          </button>
        </div>

        {open ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
               : <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />}
      </div>

      {/* Log panel */}
      {open && (
        <div style={{
          height,
          background: 'rgba(10,10,20,0.98)',
          borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Filter tabs */}
          <div style={{
            display: 'flex', gap: 2, padding: '6px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0, overflowX: 'auto',
          }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? 'rgba(139,92,246,0.2)' : 'none',
                  border: filter === f ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
                  color: filter === f ? 'var(--purple-light)' : 'var(--text-muted)',
                  padding: '2px 10px', borderRadius: 99,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}
              >
                {f}
                {f !== 'all' && (
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>
                    {logs.filter((l) => l.type === f).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Logs */}
          <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'Consolas, Monaco, monospace' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No {filter === 'all' ? '' : filter + ' '}logs yet
              </div>
            ) : (
              filtered.map((log) => {
                const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.info
                const Icon = cfg.icon
                return (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '4px 14px',
                      background: cfg.bg,
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      fontSize: 12, lineHeight: 1.5,
                    }}
                  >
                    {/* Time */}
                    <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0, fontSize: 10, marginTop: 3, minWidth: 66 }}>
                      {log.time}
                    </span>
                    {/* Type badge */}
                    <span style={{
                      flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                      color: cfg.color, minWidth: 42, marginTop: 3,
                    }}>
                      {cfg.label}
                    </span>
                    {/* Source badge */}
                    <span style={{
                      flexShrink: 0, fontSize: 10,
                      color: 'rgba(255,255,255,0.25)', minWidth: 60, marginTop: 3,
                    }}>
                      [{log.source}]
                    </span>
                    {/* Icon */}
                    <Icon size={12} style={{ color: cfg.color, flexShrink: 0, marginTop: 3 }} />
                    {/* Message */}
                    <span style={{ color: cfg.color, wordBreak: 'break-word', flex: 1 }}>
                      {log.message}
                    </span>
                  </div>
                )
              })
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}
