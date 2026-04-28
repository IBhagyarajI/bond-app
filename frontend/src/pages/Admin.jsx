import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || '/api'

export default function Admin() {
  const [secret, setSecret] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function call(path, body) {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch(`${API}/admin/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, ...body })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.message)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'var(--bg)'
    }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: '2rem', color: 'var(--gold)' }}>Bond</div>
          <p style={{ color: 'var(--text3)', fontSize: '0.85rem', marginTop: '4px' }}>Admin Panel</p>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--ff-display)', marginBottom: '20px' }}>Database Manager</h3>

          {/* Secret key input */}
          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="label">Admin Secret Key</label>
            <input
              type="password"
              placeholder="Enter your ADMIN_SECRET from Render"
              value={secret}
              onChange={e => setSecret(e.target.value)}
            />
          </div>

          <div className="divider" />

          {/* Delete one user */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: '1.1rem', marginBottom: '6px' }}>
              🗑️ Delete a specific user
            </div>
            <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginBottom: '12px', lineHeight: 1.6 }}>
              Completely removes one account. That email can be used to register again fresh.
              Their friend's account stays but becomes un-bonded.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="email"
                placeholder="user@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-gold"
                disabled={loading || !secret || !email}
                onClick={() => {
                  if (confirm(`Delete account for ${email}? This cannot be undone.`))
                    call('delete-user', { email })
                }}
              >
                {loading ? '...' : 'Delete'}
              </button>
            </div>
          </div>

          <div className="divider" />

          {/* Clear all data */}
          <div>
            <div style={{ fontFamily: 'var(--ff-display)', fontSize: '1.1rem', marginBottom: '6px', color: 'var(--rose)' }}>
              ⚠️ Clear ALL data
            </div>
            <p style={{ color: 'var(--text3)', fontSize: '0.82rem', marginBottom: '12px', lineHeight: 1.6 }}>
              Deletes all memories, bucket list, check-ins, and breaks all bonds.
              User accounts (emails + passwords) are <strong>kept</strong> — only activity data is removed.
            </p>
            <button
              className="btn btn-danger"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading || !secret}
              onClick={() => {
                if (confirm('Clear ALL data from the database? Accounts stay but everything else is wiped.'))
                  call('clear-all', {})
              }}
            >
              {loading ? 'Working...' : 'Clear all data'}
            </button>
          </div>

          {/* Result / Error */}
          {result && (
            <div style={{
              marginTop: '20px', background: 'rgba(125,184,160,0.1)',
              border: '1px solid var(--sage)', borderRadius: 'var(--radius-sm)',
              padding: '14px', color: 'var(--sage)', fontSize: '0.85rem', lineHeight: 1.6
            }}>
              ✅ {result}
            </div>
          )}
          {error && (
            <div style={{
              marginTop: '20px', background: 'rgba(232,80,80,0.1)',
              border: '1px solid rgba(232,80,80,0.3)', borderRadius: 'var(--radius-sm)',
              padding: '14px', color: '#e85050', fontSize: '0.85rem'
            }}>
              ❌ {error}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--text3)' }}>
          Only you know the ADMIN_SECRET — keep it private.
        </p>
      </div>
    </div>
  )
}
