import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const API = import.meta.env.VITE_API_URL || '/api'

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSent(true)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: 'radial-gradient(ellipse at 50% 0%, rgba(232,184,109,0.06) 0%, transparent 60%)'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: '2.5rem', color: 'var(--gold)', marginBottom: '8px' }}>Bond</div>
          <p style={{ color: 'var(--text3)', fontSize: '0.9rem' }}>Reset your password</p>
        </div>

        <div className="card">
          {sent ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📧</div>
              <h3 style={{ fontFamily: 'var(--ff-display)', marginBottom: '12px' }}>Check your email!</h3>
              <p style={{ color: 'var(--text2)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '24px' }}>
                We sent a password reset link to <strong>{email}</strong>. 
                Click the link in the email to set a new password.
              </p>
              <p style={{ color: 'var(--text3)', fontSize: '0.8rem', marginBottom: '20px' }}>
                Didn't get it? Check your spam folder or try again.
              </p>
              <button className="btn btn-outline" onClick={() => setSent(false)} style={{ width: '100%', justifyContent: 'center' }}>
                Try again
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-stack">
                <p style={{ color: 'var(--text2)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '8px' }}>
                  Enter the email you used to sign up. We'll send you a link to reset your password.
                </p>
                <div className="input-group">
                  <label className="label">Email address</label>
                  <input type="email" placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                {error && (
                  <div style={{ background: 'rgba(232,80,80,0.1)', border: '1px solid rgba(232,80,80,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px', color: '#e85050', fontSize: '0.85rem' }}>
                    {error}
                  </div>
                )}
                <button type="submit" className="btn btn-gold" disabled={loading}
                  style={{ width: '100%', justifyContent: 'center', padding: '14px' }}>
                  {loading ? 'Sending...' : 'Send reset link 📧'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8rem', color: 'var(--text3)' }}>
          <button onClick={() => navigate('/auth')}
            style={{ color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>
            ← Back to sign in
          </button>
        </p>
      </div>
    </div>
  )
}
