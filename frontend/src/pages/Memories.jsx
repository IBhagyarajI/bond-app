import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const EMOJIS = ['✨', '❤️', '🎉', '🌍', '🍕', '☕', '🎵', '🌅', '🏔️', '🎮', '📚', '🌊', '🌸', '🎭', '🤣']

export default function Memories() {
  const { apiFetch, showToast, user } = useAuth()
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', image_url: '', memory_date: '', emoji: '✨' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/memories')
      setMemories(data)
    } catch {}
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const memory = await apiFetch('/memories', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      setMemories(m => [memory, ...m])
      showToast('Memory added! 📸')
      setShowModal(false)
      setForm({ title: '', description: '', image_url: '', memory_date: '', emoji: '✨' })
    } catch (err) {
      showToast(err.message, 'error')
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this memory?')) return
    try {
      await apiFetch(`/memories/${id}`, { method: 'DELETE' })
      setMemories(m => m.filter(x => x.id !== id))
      showToast('Memory removed')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  if (!user?.friend_id) {
    return (
      <div>
        <h2 className="page-title">Memories</h2>
        <div className="empty-state">
          <div className="empty-icon">📸</div>
          <h3>Bond with your friend first</h3>
          <p>Once you're connected, you can start capturing memories together.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="page-title">Memories</h2>
          <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>
            {memories.length} moment{memories.length !== 1 ? 's' : ''} captured together
          </p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>+ Add Memory</button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /> Loading memories...</div>
      ) : memories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📸</div>
          <h3>No memories yet</h3>
          <p>Start capturing your first moment together!</p>
          <button className="btn btn-gold" style={{ marginTop: '20px' }} onClick={() => setShowModal(true)}>
            Add first memory
          </button>
        </div>
      ) : (
        <div className="grid-3">
          {memories.map(m => (
            <div key={m.id} className="memory-card">
              {m.image_url ? (
                <img src={m.image_url} alt={m.title} className="memory-img" onError={e => e.target.style.display = 'none'} />
              ) : (
                <div className="memory-img-placeholder">{m.emoji}</div>
              )}
              <div className="memory-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="memory-title">{m.title}</div>
                  {m.created_by === user.id && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      style={{ color: 'var(--text3)', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 8px' }}
                    >✕</button>
                  )}
                </div>
                {m.description && <p className="memory-desc">{m.description}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <span className="memory-date">{m.memory_date}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>by {m.creator_name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add memory modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3 className="modal-title">Capture a Memory</h3>
            <form onSubmit={handleAdd}>
              <div className="form-stack">
                <div className="input-group">
                  <label className="label">Pick an emoji</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {EMOJIS.map(em => (
                      <button
                        type="button"
                        key={em}
                        onClick={() => set('emoji', em)}
                        style={{
                          fontSize: '1.4rem', padding: '8px', border: `2px solid ${form.emoji === em ? 'var(--gold)' : 'var(--border)'}`,
                          borderRadius: '8px', background: form.emoji === em ? 'var(--gold-dim)' : 'var(--bg3)',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >{em}</button>
                    ))}
                  </div>
                </div>
                <div className="input-group">
                  <label className="label">Title *</label>
                  <input type="text" placeholder="e.g. That rainy coffee afternoon" value={form.title} onChange={e => set('title', e.target.value)} required />
                </div>
                <div className="input-group">
                  <label className="label">Description</label>
                  <textarea placeholder="Tell the story of this moment..." value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
                </div>
                <div className="input-group">
                  <label className="label">Image URL (optional)</label>
                  <input type="url" placeholder="https://..." value={form.image_url} onChange={e => set('image_url', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="label">Date</label>
                  <input type="date" value={form.memory_date} onChange={e => set('memory_date', e.target.value)} max={new Date().toISOString().split('T')[0]} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-gold" disabled={saving}>{saving ? 'Saving...' : 'Save Memory'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
