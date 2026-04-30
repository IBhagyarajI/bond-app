import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL || '/api'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) { setVerifying(false); return }
    fetch(`${API}/auth/verify-reset-token?token=${token}`)
      .then(r => r.json())
      .then(d => { setTokenValid(d.valid); setVerifying(false) })
      .catch(() => { setTokenValid(false); setVerifying(false) })
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError("Passwords don't match"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone(true)
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(232,184,109,0.06) 0%, transparent 60%)'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: '2.5rem', color: 'var(--gold)', marginBottom: '8px' }}>Bond</div>
          <p style={{ color: 'var(--text3)', fontSize: '0.9rem' }}>Set a new password</p>
        </div>

        <div className="card">
          {verifying ? (
            <div className="loading"><div className="spinner" /> Verifying link...</div>
          ) : !tokenValid ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❌</div>
              <h3 style={{ fontFamily: 'var(--ff-display)', marginBottom: '12px' }}>Link is invalid or expired</h3>
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Reset links expire after 1 hour. Please request a new one.
              </p>
              <button className="btn btn-gold" onClick={() => navigate('/forgot-password')}
                style={{ width: '100%', justifyContent: 'center' }}>
                Request new link
              </button>
            </div>
          ) : done ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
              <h3 style={{ fontFamily: 'var(--ff-display)', marginBottom: '12px' }}>Password updated!</h3>
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: '20px' }}>
                You can now log in with your new password.
              </p>
              <button className="btn btn-gold" onClick={() => navigate('/auth?mode=login')}
                style={{ width: '100%', justifyContent: 'center' }}>
                Go to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-stack">
                <div className="input-group">
                  <label className="label">New password</label>
                  <input type="password" placeholder="Min 6 characters"
                    value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                </div>
                <div className="input-group">
                  <label className="label">Confirm new password</label>
                  <input type="password" placeholder="Type it again"
                    value={confirm} onChange={e => setConfirm(e.target.value)} required />
                </div>
                {error && (
                  <div style={{ background: 'rgba(232,80,80,0.1)', border: '1px solid rgba(232,80,80,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px', color: '#e85050', fontSize: '0.85rem' }}>
                    {error}
                  </div>
                )}
                <button type="submit" className="btn btn-gold" disabled={loading}
                  style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                  {loading ? 'Saving...' : 'Set new password ✓'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
