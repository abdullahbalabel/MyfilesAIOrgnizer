import {
  FolderOpen, LayoutDashboard, Settings, History,
  Sparkles, ChevronRight, FolderSync
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'organizer', icon: FolderSync, label: 'Organizer' },
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'history', icon: History, label: 'History' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ active, setActive, fileCounts }) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Sparkles size={18} color="white" />
        </div>
        <div className="sidebar-logo-text">
          <h1>MyFiles AI</h1>
          <span>Smart Organizer</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
          <div
            key={id}
            className={`nav-item ${active === id ? 'active' : ''}`}
            onClick={() => setActive(id)}
          >
            <Icon size={16} />
            {label}
            {id === 'organizer' && fileCounts?.scanned > 0 && (
              <span className="badge">{fileCounts.scanned}</span>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Powered by Gemini AI
        </div>
      </div>
    </aside>
  )
}
