import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const SITUATIONS = [
  'Going through a breakup',
  'Stressed about work / studies',
  'Feeling anxious or overwhelmed',
  'Lost someone close to them',
  'Having a hard week',
  'Feeling lonely',
  'Dealing with family issues',
  'Struggling with confidence',
]

export default function Support() {
  const { apiFetch, showToast, user } = useAuth()
  const [situation, setSituation] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!situation.trim()) { showToast('Describe the situation first', 'error'); return }
    setLoading(true)
    try {
      const data = await apiFetch('/ai/support', {
        method: 'POST',
        body: JSON.stringify({ situation, friend_name: user?.friend?.name })
      })
      setResponse(data.response)
    } catch (err) {
      showToast(err.message, 'error')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      <h2 className="page-title">Support Mode</h2>
      <p className="page-subtitle">
        {user?.friend?.name ? `Is ${user.friend.name} going through something?` : 'Is your friend going through something?'} Get personalized ideas on how to show up.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-stack">
          {/* Quick options */}
          <div>
            <div className="label" style={{ marginBottom: '12px' }}>Quick select or type below</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {SITUATIONS.map(s => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSituation(s)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '50px',
                    border: `1px solid ${situation === s ? 'var(--gold)' : 'var(--border)'}`,
                    background: situation === s ? 'var(--gold-dim)' : 'var(--bg3)',
                    color: situation === s ? 'var(--gold)' : 'var(--text2)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >{s}</button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label className="label">
              What is {user?.friend?.name || 'your friend'} going through?
            </label>
            <textarea
              value={situation}
              onChange={e => setSituation(e.target.value)}
              placeholder={`e.g. ${user?.friend?.name || 'My friend'} just found out they didn't get the job they really wanted...`}
              rows={4}
            />
          </div>

          <button
            type="submit"
            className="btn btn-gold"
            disabled={loading || !situation.trim()}
            style={{ alignSelf: 'flex-start', padding: '14px 32px' }}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 16, height: 16 }} /> Thinking of ways to help...</>
            ) : 'Get support ideas ✦'}
          </button>
        </div>
      </form>

      {response && (
        <div className="ai-response" style={{ marginTop: '32px' }}>
          <div className="ai-label">✦ Ways to support {user?.friend?.name || 'your friend'}</div>
          <div className="ai-text">{response}</div>
          <button
            className="btn btn-outline"
            style={{ marginTop: '20px' }}
            onClick={() => { setResponse(null); setSituation('') }}
          >
            Try another situation
          </button>
        </div>
      )}

      {/* Tip */}
      {!response && (
        <div className="card" style={{ marginTop: '32px', background: 'transparent', borderStyle: 'dashed' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text3)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--text2)' }}>💡 Tip</strong><br />
            The more detail you give, the more specific and meaningful the suggestions will be. 
            Feel free to describe exactly what {user?.friend?.name || 'your friend'} told you.
          </div>
        </div>
      )}
    </div>
  )
}
