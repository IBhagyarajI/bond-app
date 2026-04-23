import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const MOODS = [
  { value: 1, emoji: '😔', label: 'Down' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Amazing' },
]

export default function CheckIn() {
  const { apiFetch, showToast, user } = useAuth()
  const [mood, setMood] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!mood) { showToast('Pick a mood first!', 'error'); return }
    setLoading(true)
    try {
      const data = await apiFetch('/ai/checkin', {
        method: 'POST',
        body: JSON.stringify({ mood, message })
      })
      setResponse(data.response)
      setDone(true)
    } catch (err) {
      showToast(err.message, 'error')
    }
    setLoading(false)
  }

  function reset() {
    setMood(null)
    setMessage('')
    setResponse(null)
    setDone(false)
  }

  if (!user?.friend_id) {
    return (
      <div>
        <h2 className="page-title">Daily Check-in</h2>
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <h3>Bond with your friend first</h3>
          <p>Once connected, you can share how you're feeling every day.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      <h2 className="page-title">Daily Check-in</h2>
      <p className="page-subtitle">How are you feeling today? Share it — your bond will respond with care.</p>

      {done ? (
        <div>
          <div style={{ display: 'flex', align: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ fontSize: '3rem' }}>{MOODS.find(m => m.value === mood)?.emoji}</div>
            <div>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: '1.2rem' }}>You checked in as <em>{MOODS.find(m => m.value === mood)?.label}</em></div>
              {message && <div style={{ color: 'var(--text2)', fontSize: '0.9rem', marginTop: '4px' }}>"{message}"</div>}
            </div>
          </div>

          <div className="ai-response" style={{ marginBottom: '24px' }}>
            <div className="ai-label">✦ Bond says</div>
            <div className="ai-text">{response}</div>
          </div>

          <button className="btn btn-outline" onClick={reset}>Check in again</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-stack">
            <div className="card">
              <div className="label" style={{ marginBottom: '16px' }}>How are you feeling right now?</div>
              <div className="mood-grid">
                {MOODS.map(m => (
                  <button
                    type="button"
                    key={m.value}
                    className={`mood-btn ${mood === m.value ? 'selected' : ''}`}
                    onClick={() => setMood(m.value)}
                  >
                    {m.emoji}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="label">Want to share more? (optional)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={`Tell ${user.friend?.name} what's on your mind...`}
                rows={4}
              />
            </div>

            <button
              type="submit"
              className="btn btn-gold"
              disabled={loading || !mood}
              style={{ alignSelf: 'flex-start', padding: '14px 32px' }}
            >
              {loading ? (
                <><div className="spinner" style={{ width: 16, height: 16 }} /> Getting your response...</>
              ) : 'Share & get insight ✦'}
            </button>
          </div>
        </form>
      )}

      {/* What is this section */}
      <div className="card" style={{ marginTop: '32px', background: 'transparent', borderStyle: 'dashed' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text3)', lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--text2)' }}>About check-ins</strong><br />
          Your mood and message are stored privately for your bond. Our AI reads your friendship history to give you a personal, meaningful response — not a generic one.
        </div>
      </div>
    </div>
  )
}
