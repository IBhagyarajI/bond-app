import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const EMOJIS = ['✨','❤️','🎉','🌍','🍕','☕','🎵','🌅','🏔️','🎮','📚','🌊','🌸','🎭','🤣']

export default function Memories() {
  const { apiFetch, showToast, user } = useAuth()
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', image_url: '', memory_date: '', emoji: '✨' })
  const [saving, setSaving] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const fileRef = useRef()

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

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return

    // Check size — warn if > 2MB
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image too large. Please use an image under 2MB.', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target.result
      setImagePreview(base64)
      set('image_url', base64)
    }
    reader.readAsDataURL(file)
  }

  function resetModal() {
    setShowModal(false)
    setForm({ title: '', description: '', image_url: '', memory_date: '', emoji: '✨' })
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

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
      resetModal()
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
          <p>Once connected, you can start capturing memories together.</p>
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
                <img src={m.image_url} alt={m.title} className="memory-img"
                  onError={e => { e.target.style.display='none' }} />
              ) : (
                <div className="memory-img-placeholder">{m.emoji}</div>
              )}
              <div className="memory-body">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div className="memory-title">{m.title}</div>
                  {Number(m.created_by) === user.id && (
                    <button onClick={() => handleDelete(m.id)}
                      style={{ color:'var(--text3)', fontSize:'0.8rem', background:'none', border:'none', cursor:'pointer', padding:'0 0 0 8px' }}>✕</button>
                  )}
                </div>
                {m.description && <p className="memory-desc">{m.description}</p>}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'10px' }}>
                  <span className="memory-date">{m.memory_date}</span>
                  <span style={{ fontSize:'0.75rem', color:'var(--text3)' }}>by {m.creator_name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && resetModal()}>
          <div className="modal">
            <h3 className="modal-title">Capture a Memory</h3>
            <form onSubmit={handleAdd}>
              <div className="form-stack">

                {/* Emoji picker */}
                <div className="input-group">
                  <label className="label">Pick an emoji</label>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    {EMOJIS.map(em => (
                      <button type="button" key={em} onClick={() => set('emoji', em)}
                        style={{
                          fontSize:'1.4rem', padding:'8px',
                          border: `2px solid ${form.emoji === em ? 'var(--gold)' : 'var(--border)'}`,
                          borderRadius:'8px',
                          background: form.emoji === em ? 'var(--gold-dim)' : 'var(--bg3)',
                          cursor:'pointer', transition:'all 0.15s'
                        }}>{em}</button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="input-group">
                  <label className="label">Title *</label>
                  <input type="text" placeholder="e.g. That rainy coffee afternoon"
                    value={form.title} onChange={e => set('title', e.target.value)} required />
                </div>

                {/* Description */}
                <div className="input-group">
                  <label className="label">Description</label>
                  <textarea placeholder="Tell the story of this moment..."
                    value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
                </div>

                {/* Image upload */}
                <div className="input-group">
                  <label className="label">Photo (optional)</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{
                      border: `2px dashed ${imagePreview ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: imagePreview ? '0' : '24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'var(--bg3)',
                      overflow: 'hidden',
                      transition: 'border-color 0.2s'
                    }}
                  >
                    {imagePreview ? (
                      <div style={{ position: 'relative' }}>
                        <img src={imagePreview} alt="preview"
                          style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }} />
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setImagePreview(null); set('image_url', ''); if(fileRef.current) fileRef.current.value='' }}
                          style={{
                            position: 'absolute', top: '8px', right: '8px',
                            background: 'rgba(0,0,0,0.6)', color: 'white',
                            border: 'none', borderRadius: '50%', width: '28px', height: '28px',
                            cursor: 'pointer', fontSize: '0.9rem'
                          }}
                        >✕</button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
                        <div style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>Click to upload a photo</div>
                        <div style={{ color: 'var(--text3)', fontSize: '0.75rem', marginTop: '4px' }}>JPG, PNG, WEBP · max 2MB</div>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*"
                    onChange={handleImageChange} style={{ display: 'none' }} />
                </div>

                {/* Date */}
                <div className="input-group">
                  <label className="label">Date</label>
                  <input type="date" value={form.memory_date}
                    onChange={e => set('memory_date', e.target.value)}
                    max={new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={resetModal}>Cancel</button>
                <button type="submit" className="btn btn-gold" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
