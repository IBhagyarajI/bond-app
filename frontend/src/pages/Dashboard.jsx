import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function initials(name) { return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?' }
function daysSince(dateStr) { if (!dateStr) return 0; return Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24)) }

function Avatar({ user, size = 44 }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: user?.avatar_color || 'var(--gold)', overflow: 'hidden', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {user?.profile_pic ? <img src={user.profile_pic} alt={user?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(user?.name)}
    </div>
  )
}

export default function Dashboard() {
  const { user, apiFetch, showToast, connectFriend } = useAuth()
  const navigate = useNavigate()
  const [insights, setInsights] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [connectCode, setConnectCode] = useState('')
  const [connecting, setConnecting] = useState(false)

  useEffect(() => { if (user?.friend_id) loadInsights() }, [user?.friend_id])

  async function loadInsights() {
    setLoadingInsights(true)
    try { const data = await apiFetch('/ai/insights'); setInsights(data) } catch {}
    setLoadingInsights(false)
  }

  async function handleConnect(e) {
    e.preventDefault(); setConnecting(true)
    try { await connectFriend(connectCode.toUpperCase()); showToast('🎉 You are now bonded!', 'success') }
    catch (err) { showToast(err.message, 'error') }
    setConnecting(false)
  }

  if (!user?.friend_id) {
    return (
      <div>
        <h2 className="page-title">Welcome, {user?.name} 👋</h2>
        <p className="page-subtitle">You're one step away from your friendship space.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '700px' }}>
          <div className="card">
            <div style={{ fontSize: '0.8rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Your invite code</div>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: '2.5rem', color: 'var(--gold)', letterSpacing: '0.15em', marginBottom: '16px' }}>{user?.invite_code}</div>
            <p style={{ color: 'var(--text3)', fontSize: '0.85rem', lineHeight: 1.6 }}>Share this with your friend so they can connect with you.</p>
            <button className="btn btn-outline" style={{ marginTop: '16px', width: '100%', justifyContent: 'center' }} onClick={() => { navigator.clipboard.writeText(user?.invite_code); showToast('Code copied!') }}>Copy code</button>
          </div>
          <div className="card">
            <div style={{ fontSize: '0.8rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Enter friend's code</div>
            <p style={{ color: 'var(--text3)', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '16px' }}>Ask your friend for their 8-character invite code.</p>
            <form onSubmit={handleConnect}>
              <div className="form-stack">
                <input type="text" placeholder="e.g. AB12CD34" value={connectCode} onChange={e => setConnectCode(e.target.value.toUpperCase())} maxLength={8} style={{ letterSpacing: '0.1em', fontSize: '1.1rem', textAlign: 'center' }} />
                <button type="submit" className="btn btn-gold" disabled={connecting || connectCode.length !== 8} style={{ justifyContent: 'center' }}>{connecting ? 'Connecting...' : 'Bond now 🔗'}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const bondDays = daysSince(user.bond_start_date)
  return (
    <div>
      <div className="bond-header">
        <div className="bond-avatars">
          <Avatar user={user} size={44} />
          <Avatar user={user.friend} size={44} />
        </div>
        <div>
          <div className="bond-names">{user.name} & {user.friend?.name}</div>
          <div className="bond-since">Together since {user.bond_start_date} · {bondDays} day{bondDays !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}><span className="badge badge-gold">✦ Bonded</span></div>
      </div>

      {insights && (
        <div className="stats-row">
          {[{ value: insights.stats.bondDays, label: 'Days Together' }, { value: insights.stats.memoriesCount, label: 'Memories' }, { value: `${insights.stats.bucketCompleted}/${insights.stats.bucketTotal}`, label: 'Bucket Done' }, { value: insights.stats.avgMood ? `${insights.stats.avgMood}/5` : '—', label: 'Avg Mood' }].map(s => (
            <div key={s.label} className="stat-card"><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
          ))}
        </div>
      )}

      {loadingInsights ? <div className="loading"><div className="spinner" /> Generating your bond insight...</div>
        : insights ? <div className="ai-response" style={{ marginBottom: '32px' }}><div className="ai-label">✦ Bond Insight</div><div className="ai-text">{insights.response}</div></div> : null}

      <h3 style={{ marginBottom: '16px', fontFamily: 'var(--ff-display)' }}>Quick Actions</h3>
      <div className="grid-3" style={{ marginBottom: '32px' }}>
        {[{ icon: '📸', label: 'Add a Memory', path: '/app/memories', color: 'var(--gold)' }, { icon: '💬', label: 'Daily Check-in', path: '/app/checkin', color: 'var(--rose)' }, { icon: '🎯', label: 'Bucket List', path: '/app/bucket', color: 'var(--sage)' }, { icon: '🤝', label: 'Support Mode', path: '/app/support', color: '#a78bfa' }].map(a => (
          <div key={a.label} className="card-sm" onClick={() => navigate(a.path)} style={{ cursor: 'pointer', transition: 'transform 0.2s', display: 'flex', alignItems: 'center', gap: '14px' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = ''}>
            <span style={{ fontSize: '1.6rem' }}>{a.icon}</span>
            <span style={{ fontFamily: 'var(--ff-display)', fontSize: '1rem', color: a.color }}>{a.label}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your invite code</div>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: '1.8rem', color: 'var(--gold)', letterSpacing: '0.1em' }}>{user.invite_code}</div>
        </div>
        <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(user.invite_code); showToast('Code copied!') }}>Copy</button>
      </div>
    </div>
  )
}
