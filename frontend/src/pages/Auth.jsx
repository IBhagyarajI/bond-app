import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Auth() {
  const [params] = useSearchParams()
  const [mode, setMode] = useState(params.get('mode') === 'login' ? 'login' : 'register')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
      } else {
        await register(form.name, form.email, form.password)
      }
      navigate('/app')
    } catch (err) {
      setError(err.message)
    }
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
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: '2.5rem', color: 'var(--gold)', marginBottom: '8px' }}>
            Bond
          </div>
          <p style={{ color: 'var(--text3)', fontSize: '0.9rem' }}>
            {mode === 'login' ? 'Welcome back' : 'Begin your friendship journey'}
          </p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)', padding: '4px', marginBottom: '28px' }}>
            {['register', 'login'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 500,
                  background: mode === m ? 'var(--bg2)' : 'transparent',
                  color: mode === m ? 'var(--text)' : 'var(--text3)',
                  border: mode === m ? '1px solid var(--border)' : '1px solid transparent',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {m === 'register' ? 'Create account' : 'Sign in'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-stack">
              {mode === 'register' && (
                <div className="input-group">
                  <label className="label">Your name</label>
                  <input
                    type="text" placeholder="e.g. Priya"
                    value={form.name} onChange={e => set('name', e.target.value)} required
                  />
                </div>
              )}
              <div className="input-group">
                <label className="label">Email</label>
                <input
                  type="email" placeholder="you@example.com"
                  value={form.email} onChange={e => set('email', e.target.value)} required
                />
              </div>
              <div className="input-group">
                <label className="label">Password</label>
                <input
                  type="password" placeholder="••••••••"
                  value={form.password} onChange={e => set('password', e.target.value)} required
                  minLength={6}
                />
              </div>

              {error && (
                <div style={{ background: 'rgba(232,80,80,0.1)', border: '1px solid rgba(232,80,80,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px', color: '#e85050', fontSize: '0.85rem' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-gold"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '14px' }}
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8rem', color: 'var(--text3)' }}>
          <button onClick={() => navigate('/')} style={{ color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>
            ← Back to home
          </button>
        </p>
      </div>
    </div>
  )
}
