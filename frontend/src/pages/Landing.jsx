import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        padding: '24px 48px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ fontFamily: 'var(--ff-display)', fontSize: '1.8rem', color: 'var(--gold)' }}>
          Bond
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={() => navigate('/auth?mode=login')}>Sign in</button>
          <button className="btn btn-gold" onClick={() => navigate('/auth?mode=register')}>Get started</button>
        </div>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 48px', textAlign: 'center', position: 'relative' }}>
        {/* Background orbs */}
        <div style={{
          position: 'absolute', width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,184,109,0.05) 0%, transparent 70%)',
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none'
        }} />

        <div className="badge badge-gold" style={{ marginBottom: '24px' }}>✦ A space just for two</div>

        <h1 style={{ marginBottom: '24px', maxWidth: '700px' }}>
          <em>Friendships</em> deserve<br />
          a home of their own
        </h1>

        <p style={{ color: 'var(--text2)', maxWidth: '480px', fontSize: '1.05rem', lineHeight: 1.8, marginBottom: '40px' }}>
          Bond is an AI-powered companion for you and your closest friend — to capture memories, support each other, and grow together.
        </p>

        <button
          className="btn btn-gold"
          style={{ fontSize: '1rem', padding: '16px 40px' }}
          onClick={() => navigate('/auth?mode=register')}
        >
          Start your bond →
        </button>

        {/* Features */}
        <div className="grid-3" style={{ marginTop: '80px', maxWidth: '900px', width: '100%', textAlign: 'left' }}>
          {[
            { emoji: '📸', title: 'Shared Memories', desc: 'A private scrapbook of moments only the two of you can see and add to.' },
            { emoji: '🎯', title: 'Bucket List', desc: 'Build and track adventures together — from coffee to world trips.' },
            { emoji: '🤝', title: 'Support Mode', desc: 'AI-powered suggestions on how to show up when your friend needs you most.' },
            { emoji: '💬', title: 'Daily Check-ins', desc: 'A gentle ritual to share how you\'re feeling and stay emotionally close.' },
            { emoji: '✨', title: 'Bond Insights', desc: 'AI reflections on what makes your friendship unique and beautiful.' },
            { emoji: '🔗', title: 'Private & Paired', desc: 'Just you two — no algorithms, no strangers, no noise.' },
          ].map(f => (
            <div key={f.title} className="card-sm" style={{ background: 'var(--bg2)' }}>
              <div style={{ fontSize: '1.6rem', marginBottom: '12px' }}>{f.emoji}</div>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: '1.1rem', marginBottom: '8px' }}>{f.title}</div>
              <div style={{ color: 'var(--text3)', fontSize: '0.85rem', lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: '0.8rem', borderTop: '1px solid var(--border)' }}>
        Made with ♥ for the friendships that matter most
      </footer>
    </div>
  )
}
