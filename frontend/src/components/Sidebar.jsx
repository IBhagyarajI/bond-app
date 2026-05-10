import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { path: '/app',          icon: '⌂',  label: 'Home' },
  { path: '/app/memories', icon: '📸', label: 'Memories' },
  { path: '/app/bucket',   icon: '🎯', label: 'Bucket List' },
  { path: '/app/checkin',  icon: '💬', label: 'Check-in' },
  { path: '/app/support',  icon: '🤝', label: 'Support' },
  { path: '/app/glowup',   icon: '✨', label: 'Glow Up' },
  { path: '/app/profile',  icon: '👤', label: 'Profile' },
]

function initials(name) { return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?' }

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  function handleLogout() { logout(); navigate('/') }
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">Bond</div>
      <nav style={{ flex: 1 }}>
        {NAV.map(n => (
          <div key={n.path} className={`nav-item ${location.pathname === n.path ? 'active' : ''}`} onClick={() => navigate(n.path)}>
            <span className="nav-icon">{n.icon}</span><span>{n.label}</span>
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-card" onClick={() => navigate('/app/profile')} style={{ cursor: 'pointer' }}>
          <div className="avatar" style={{ background: user?.avatar_color || 'var(--gold)', overflow: 'hidden', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {user?.photo_url ? <img src={user.photo_url} alt="pfp" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(user?.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); handleLogout() }} title="Sign out" style={{ color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontSize: '1rem' }}>↩</button>
        </div>
      </div>
    </aside>
  )
}
