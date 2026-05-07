import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
const API = import.meta.env.VITE_API_URL || '/api'

export default function Profile() {
  const { user, setUser, logout, showToast, getToken } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const fileRef = useRef()

  async function handlePhotoChange(e) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    try {
      const form = new FormData(); form.append('photo', file)
      const res = await fetch(`${API}/users/upload-profile-pic`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUser(prev => ({ ...prev, profile_pic: data.url }))
      showToast('Profile picture updated! ✨')
    } catch (err) { showToast(err.message || 'Upload failed', 'error') }
    setUploading(false)
  }

  async function handleSaveName() {
    if (!newName.trim()) return; setSavingName(true)
    try {
      const res = await fetch(`${API}/auth/update-name`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` }, body: JSON.stringify({ name: newName.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUser(prev => ({ ...prev, name: data.name })); setEditingName(false); showToast('Name updated! ✅')
    } catch (err) { showToast(err.message || 'Failed to update name', 'error') }
    setSavingName(false)
  }

  function copyInviteCode() { navigator.clipboard.writeText(user?.invite_code || ''); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ padding: '24px', maxWidth: '480px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--ff-display)', color: 'var(--gold)', fontSize: '2rem', marginBottom: '32px' }}>Profile</h1>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <div onClick={() => !uploading && fileRef.current.click()} style={{ width: 110, height: 110, borderRadius: '50%', border: '3px solid var(--gold)', overflow: 'hidden', cursor: 'pointer', position: 'relative', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {user?.profile_pic ? <img src={user.profile_pic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '2.5rem', color: 'var(--gold)', fontFamily: 'var(--ff-display)' }}>{initials}</span>}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: uploading ? 1 : 0, transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => !uploading && (e.currentTarget.style.opacity = 0)}>
            <span style={{ fontSize: '1.5rem' }}>{uploading ? '⏳' : '📷'}</span>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
        <p style={{ color: 'var(--text3)', fontSize: '0.8rem', marginTop: '8px' }}>{uploading ? 'Uploading...' : 'Tap photo to change'}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <p style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>NAME</p>
            {!editingName && <button onClick={() => { setNewName(user?.name || ''); setEditingName(true) }} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.8rem', cursor: 'pointer' }}>✏️ Edit</button>}
          </div>
          {editingName ? (
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveName()} autoFocus style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid var(--gold)', background: 'var(--bg3)', color: 'var(--text)', fontSize: '0.95rem' }} />
              <button onClick={handleSaveName} disabled={savingName} style={{ padding: '8px 14px', background: 'var(--gold)', border: 'none', borderRadius: '8px', color: 'var(--bg)', fontWeight: 700, cursor: 'pointer' }}>{savingName ? '...' : 'Save'}</button>
              <button onClick={() => setEditingName(false)} style={{ padding: '8px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text3)', cursor: 'pointer' }}>✕</button>
            </div>
          ) : <p style={{ color: 'var(--text)', fontWeight: 600 }}>{user?.name}</p>}
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <p style={{ color: 'var(--text3)', fontSize: '0.75rem', marginBottom: '4px' }}>EMAIL</p>
          <p style={{ color: 'var(--text)' }}>{user?.email}</p>
        </div>

        <div className="card" style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={copyInviteCode}>
          <p style={{ color: 'var(--text3)', fontSize: '0.75rem', marginBottom: '4px' }}>YOUR INVITE CODE</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.15em', fontSize: '1.1rem' }}>{user?.invite_code}</p>
            <span style={{ fontSize: '0.8rem', color: 'var(--text3)' }}>{copied ? '✅ Copied!' : '📋 Tap to copy'}</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <p style={{ color: 'var(--text3)', fontSize: '0.75rem', marginBottom: '4px' }}>FRIEND STATUS</p>
          <p style={{ color: user?.friend_id ? '#4ade80' : 'var(--text3)' }}>
            {user?.friend_id ? `💚 Connected with ${user.friend?.name || 'your friend'}` : '⏳ Not connected yet'}
          </p>
        </div>

        {user?.friend && (
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--border)', overflow: 'hidden', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {user.friend.profile_pic ? <img src={user.friend.profile_pic} alt="Friend" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'var(--text3)', fontSize: '1.2rem' }}>{user.friend.name?.[0]?.toUpperCase()}</span>}
            </div>
            <div>
              <p style={{ color: 'var(--text3)', fontSize: '0.75rem', marginBottom: '2px' }}>YOUR FRIEND</p>
              <p style={{ color: 'var(--text)', fontWeight: 600 }}>{user.friend.name}</p>
            </div>
          </div>
        )}
      </div>

      <button onClick={logout} style={{ marginTop: '32px', width: '100%', padding: '14px', background: 'rgba(232,80,80,0.12)', border: '1px solid rgba(232,80,80,0.3)', borderRadius: 'var(--radius)', color: '#e85050', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}>Sign Out</button>
    </div>
  )
}
