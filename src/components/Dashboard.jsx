import { useMemo } from 'react'
import {
  FileText, Image, Video, Music, Archive, Code2,
  FileSpreadsheet, Cpu, Palette, File, HardDrive,
  TrendingUp, FolderOpen,
} from 'lucide-react'

const CATEGORY_ICONS = {
  Documents: FileText, Spreadsheets: FileSpreadsheet,
  Images: Image, Videos: Video, Audio: Music, Archives: Archive,
  Code: Code2, Design: Palette, Applications: Cpu, Other: File,
}

const COLORS = [
  '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ec4899', '#f97316', '#6366f1', '#14b8a6',
  '#84cc16', '#ef4444',
]

export default function Dashboard({ files }) {
  const stats = useMemo(() => {
    if (!files.length) return null
    const catMap = {}
    let totalSize = 0
    files.forEach((f) => {
      if (!catMap[f.category]) catMap[f.category] = { count: 0, size: 0 }
      catMap[f.category].count++
      catMap[f.category].size += f.size || 0
      totalSize += f.size || 0
    })
    const cats = Object.entries(catMap)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data], i) => ({
        name, ...data,
        color: COLORS[i % COLORS.length],
        pct: Math.round((data.count / files.length) * 100),
      }))
    return { cats, totalSize, totalFiles: files.length }
  }, [files])

  function formatSize(bytes) {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
  }

  if (!files.length) {
    return (
      <div className="animate-fadeIn">
        <div className="page-header"><h2>Dashboard</h2><p>Scan a folder to see statistics.</p></div>
        <div className="page-body">
          <div className="empty-state">
            <div className="empty-state-icon"><TrendingUp size={32} /></div>
            <h3>No Data Yet</h3>
            <p>Go to the Organizer tab, select a folder, and scan it to see your file statistics here.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your scanned files and categories.</p>
      </div>
      <div className="page-body">
        {/* Top stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon"><FolderOpen size={20} /></div>
            <div className="stat-card-value">{stats.totalFiles.toLocaleString()}</div>
            <div className="stat-card-label">Total Files</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon"><HardDrive size={20} /></div>
            <div className="stat-card-value">{formatSize(stats.totalSize)}</div>
            <div className="stat-card-label">Total Size</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon"><TrendingUp size={20} /></div>
            <div className="stat-card-value">{stats.cats.length}</div>
            <div className="stat-card-label">Categories</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon"><File size={20} /></div>
            <div className="stat-card-value">{formatSize(Math.round(stats.totalSize / stats.totalFiles))}</div>
            <div className="stat-card-label">Avg File Size</div>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="card mb-6">
          <div className="card-title mb-4">
            <TrendingUp size={16} style={{ color: 'var(--purple)' }} />
            File Categories
          </div>

          {/* Visual bar chart */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', height: 180, alignItems: 'flex-end', gap: 8 }}>
              {stats.cats.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.name] || File
                const heightPct = Math.max((cat.count / stats.cats[0].count) * 100, 6)
                return (
                  <div
                    key={cat.name}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                    title={`${cat.name}: ${cat.count} files (${cat.pct}%)`}
                  >
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{cat.count}</div>
                    <div
                      style={{
                        width: '100%', height: `${heightPct}%`,
                        background: `${cat.color}25`,
                        border: `1px solid ${cat.color}55`,
                        borderRadius: '6px 6px 0 0',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        paddingBottom: 6, transition: 'var(--transition)',
                        position: 'relative', overflow: 'hidden',
                      }}
                    >
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        height: `${cat.pct}%`, minHeight: '20%',
                        background: `${cat.color}40`,
                        transition: 'var(--transition)',
                      }} />
                      <Icon size={13} style={{ color: cat.color, position: 'relative', zIndex: 1 }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.name}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.cats.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.name] || File
              return (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Icon size={15} style={{ color: cat.color, flexShrink: 0, width: 20 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{cat.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {cat.count} files · {formatSize(cat.size)} · {cat.pct}%
                      </span>
                    </div>
                    <div className="progress-wrap">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${cat.pct}%`,
                          background: `linear-gradient(90deg, ${cat.color} 0%, ${cat.color}88 100%)`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top largest files */}
        <div className="card">
          <div className="card-title mb-4">
            <HardDrive size={16} style={{ color: 'var(--cyan)' }} />
            Largest Files
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Category</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {[...files]
                  .sort((a, b) => (b.size || 0) - (a.size || 0))
                  .slice(0, 10)
                  .map((f) => (
                    <tr key={f.id}>
                      <td className="truncate" style={{ maxWidth: 300 }}>{f.name}</td>
                      <td><span className="chip chip-gray">{f.category}</span></td>
                      <td>{f.sizeFormatted}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
