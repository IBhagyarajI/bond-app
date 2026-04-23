import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = [
  { id: 'adventure', label: '🏔️ Adventure' },
  { id: 'food', label: '🍕 Food & Drink' },
  { id: 'travel', label: '✈️ Travel' },
  { id: 'creative', label: '🎨 Creative' },
  { id: 'wellness', label: '🧘 Wellness' },
  { id: 'social', label: '🎉 Social' },
  { id: 'learning', label: '📚 Learning' },
  { id: 'other', label: '✨ Other' },
]

export default function BucketList() {
  const { apiFetch, showToast, user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ title: '', description: '', category: 'adventure' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/bucket')
      setItems(data)
    } catch {}
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const item = await apiFetch('/bucket', { method: 'POST', body: JSON.stringify(form) })
      setItems(i => [item, ...i])
      showToast('Added to bucket list! 🎯')
      setShowModal(false)
      setForm({ title: '', description: '', category: 'adventure' })
    } catch (err) {
      showToast(err.message, 'error')
    }
    setSaving(false)
  }

  async function handleComplete(id) {
    try {
      const updated = await apiFetch(`/bucket/${id}/complete`, { method: 'PATCH' })
      setItems(i => i.map(x => x.id === id ? updated : x))
      showToast('✅ Marked as done! Amazing!')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this item?')) return
    try {
      await apiFetch(`/bucket/${id}`, { method: 'DELETE' })
      setItems(i => i.filter(x => x.id !== id))
      showToast('Removed')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const pending = items.filter(x => !x.completed)
  const done = items.filter(x => x.completed)
  const filtered = filter === 'done' ? done : filter === 'pending' ? pending : items

  if (!user?.friend_id) {
    return (
      <div>
        <h2 className="page-title">Bucket List</h2>
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h3>Bond with your friend first</h3>
          <p>Connect with your friend to start building your shared bucket list.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="page-title">Bucket List</h2>
          <p style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>
            {pending.length} to do · {done.length} completed
          </p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>+ Add Item</button>
      </div>

      {/* Filter pills */}
      <div className="category-grid" style={{ marginBottom: '28px' }}>
        {[
          { id: 'all', label: `All (${items.length})` },
          { id: 'pending', label: `To Do (${pending.length})` },
          { id: 'done', label: `Done (${done.length})` },
        ].map(f => (
          <button key={f.id} className={`cat-pill ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /> Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h3>Nothing here yet</h3>
          <p>Add something you both want to do together!</p>
          <button className="btn btn-gold" style={{ marginTop: '20px' }} onClick={() => setShowModal(true)}>
            Add first item
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(item => (
            <div key={item.id} className={`bucket-item ${item.completed ? 'done' : ''}`}>
              <div
                className={`bucket-check ${item.completed ? 'done' : ''}`}
                onClick={() => !item.completed && handleComplete(item.id)}
                title={item.completed ? 'Completed!' : 'Mark as done'}
              >
                {item.completed && '✓'}
              </div>
              <div className="bucket-info">
                <div className="bucket-title">{item.title}</div>
                {item.description && <div className="bucket-desc">{item.description}</div>}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                    {CATEGORIES.find(c => c.id === item.category)?.label || item.category}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>· by {item.creator_name}</span>
                  {item.completed && item.completed_at && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--sage)' }}>
                      · done {new Date(item.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="btn-ghost"
                style={{ color: 'var(--text3)', fontSize: '0.8rem', padding: '4px 8px' }}
                onClick={() => handleDelete(item.id)}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <h3 className="modal-title">Add to Bucket List</h3>
            <form onSubmit={handleAdd}>
              <div className="form-stack">
                <div className="input-group">
                  <label className="label">What do you want to do together?</label>
                  <input type="text" placeholder="e.g. Watch the sunrise from a rooftop" value={form.title} onChange={e => set('title', e.target.value)} required />
                </div>
                <div className="input-group">
                  <label className="label">Details (optional)</label>
                  <textarea placeholder="Any specifics, dates, places..." value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
                </div>
                <div className="input-group">
                  <label className="label">Category</label>
                  <div className="category-grid">
                    {CATEGORIES.map(c => (
                      <button
                        type="button"
                        key={c.id}
                        className={`cat-pill ${form.category === c.id ? 'active' : ''}`}
                        onClick={() => set('category', c.id)}
                      >{c.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-gold" disabled={saving}>{saving ? 'Adding...' : 'Add to List'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
