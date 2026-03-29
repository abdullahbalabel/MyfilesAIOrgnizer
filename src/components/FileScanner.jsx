import { useState, useMemo } from 'react'
import {
  Search, SortAsc, SortDesc, Sparkles, Loader2,
  FileText, Image, Video, Music, Archive, Code2,
  FileSpreadsheet, Presentation, Cpu, Palette, File,
  CheckSquare, Square,
} from 'lucide-react'
import { classifyFiles } from '../services/geminiService'

const CATEGORY_ICONS = {
  Documents: FileText, Spreadsheets: FileSpreadsheet, Presentations: Presentation,
  Images: Image, Videos: Video, Audio: Music, Archives: Archive,
  Code: Code2, Design: Palette, Applications: Cpu, Other: File,
}

const CATEGORY_CHIPS = {
  Documents: 'chip-cyan', Spreadsheets: 'chip-green', Presentations: 'chip-amber',
  Images: 'chip-purple', Videos: 'chip-purple', Audio: 'chip-amber',
  Archives: 'chip-amber', Code: 'chip-green', Design: 'chip-purple',
  Applications: 'chip-red', Other: 'chip-gray',
}

export default function FileScanner({ files, folderPath, apiKey, customRules, onAnalyzed, showToast }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [filterCat, setFilterCat] = useState('All')
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState({ pct: 0, batch: 0, totalBatches: 0, done: 0, total: 0 })
  const [selected, setSelected] = useState(new Set())

  const categories = useMemo(() => {
    return ['All', ...new Set(files.map((f) => f.category))]
  }, [files])

  const filtered = useMemo(() => {
    let list = files
    if (filterCat !== 'All') list = list.filter((f) => f.category === filterCat)
    if (search) list = list.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    return [...list].sort((a, b) => {
      const va = sortBy === 'size' ? a.size : (a[sortBy] || '')
      const vb = sortBy === 'size' ? b.size : (b[sortBy] || '')
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [files, search, filterCat, sortBy, sortDir])

  function toggleSort(col) {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(col); setSortDir('asc') }
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((f) => f.id)))
  }

  async function handleAnalyze() {
    if (!apiKey) { showToast('Please add your Gemini API key in Settings first', 'error'); return }
    const toAnalyze = selected.size > 0 ? files.filter((f) => selected.has(f.id)) : files
    const totalBatches = Math.ceil(toAnalyze.length / 80)
    setAnalyzing(true)
    setProgress({ pct: 0, batch: 0, totalBatches, done: 0, total: toAnalyze.length })
    try {
      const result = await classifyFiles(
        toAnalyze, apiKey, customRules,
        (done, total, batch, tb) => {
          setProgress({ pct: Math.round((done / total) * 100), batch, totalBatches: tb, done, total })
        }
      )
      setAnalyzing(false)
      onAnalyzed(result)
      showToast(`AI classified ${result.length} files successfully!`, 'success')
    } catch (err) {
      setAnalyzing(false)
      showToast('AI analysis failed: ' + err.message, 'error')
    }
  }

  const SortIcon = sortDir === 'asc' ? SortAsc : SortDesc

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Fixed header ── */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Scanned Files <span style={{ color: 'var(--purple)', fontSize: 18 }}>({files.length})</span></h2>
            <p style={{ marginTop: 2 }}>
              {folderPath}&nbsp;·&nbsp;
              {selected.size > 0 ? `${selected.size} selected` : 'Select files or analyze all'}
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleAnalyze} disabled={analyzing} style={{ minWidth: 220 }}>
            {analyzing
              ? <><Loader2 size={15} className="animate-spin" />
                  &nbsp;{progress.batch > 0
                    ? `Batch ${progress.batch}/${progress.totalBatches} · ${progress.done}/${progress.total}`
                    : 'Starting…'}
                </>
              : <><Sparkles size={15} /> Analyze with AI</>}
          </button>
        </div>

        {/* Progress bar + batch label */}
        {analyzing && (
          <div style={{ marginTop: 10 }}>
            <div className="progress-wrap">
              <div
                className="progress-fill"
                style={{ width: `${progress.pct}%`, transition: 'width 0.3s ease' }}
              />
            </div>
            <div style={{
              marginTop: 4, fontSize: 11, color: 'var(--text-muted)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>
                {progress.batch > 0
                  ? `Batch ${progress.batch} of ${progress.totalBatches}`
                  : 'Preparing…'}
              </span>
              <span>{progress.pct}% · {progress.done} / {progress.total} files</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Fixed toolbar ── */}
      <div style={{
        padding: '10px 32px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(15,15,30,0.5)',
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34, height: 34 }}
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`btn btn-sm ${filterCat === cat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable table ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '12px 32px 24px' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <div style={{ cursor: 'pointer', display: 'flex' }} onClick={toggleAll}>
                    {selected.size === filtered.length && filtered.length > 0
                      ? <CheckSquare size={15} style={{ color: 'var(--purple)' }} />
                      : <Square size={15} />}
                  </div>
                </th>
                <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Name {sortBy === 'name' && <SortIcon size={12} />}
                  </span>
                </th>
                <th>Category</th>
                <th onClick={() => toggleSort('ext')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Type {sortBy === 'ext' && <SortIcon size={12} />}
                  </span>
                </th>
                <th onClick={() => toggleSort('size')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Size {sortBy === 'size' && <SortIcon size={12} />}
                  </span>
                </th>
                <th onClick={() => toggleSort('modified')} style={{ cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Modified {sortBy === 'modified' && <SortIcon size={12} />}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((file) => {
                const Icon = CATEGORY_ICONS[file.category] || File
                const isSelected = selected.has(file.id)
                return (
                  <tr
                    key={file.id}
                    className={isSelected ? 'file-row-selected' : ''}
                    onClick={() => toggleSelect(file.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      {isSelected
                        ? <CheckSquare size={14} style={{ color: 'var(--purple)' }} />
                        : <Square size={14} />}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon size={14} className={`cat-${file.category}`} style={{ flexShrink: 0 }} />
                        <span className="truncate" style={{ maxWidth: 340 }}>{file.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${CATEGORY_CHIPS[file.category] || 'chip-gray'}`}>
                        {file.category}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 11 }}>
                      .{file.ext || '—'}
                    </td>
                    <td>{file.sizeFormatted}</td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {file.modified ? new Date(file.modified).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No files match your search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            Showing 500 of {filtered.length} files
          </div>
        )}
      </div>
    </div>
  )
}
