import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const FOCUS_AREAS = [
  { id: 'fitness',      label: 'Physical Fitness',     icon: '💪' },
  { id: 'skincare',     label: 'Skincare & Grooming',  icon: '🧴' },
  { id: 'mental',       label: 'Mental Health',         icon: '🧠' },
  { id: 'learning',     label: 'Learning & Skills',    icon: '📚' },
  { id: 'career',       label: 'Career & Productivity',icon: '💼' },
  { id: 'mindfulness',  label: 'Mindfulness',          icon: '🧘' },
  { id: 'habits',       label: 'Break Bad Habits',     icon: '🚫' },
  { id: 'sleep',        label: 'Sleep & Recovery',     icon: '😴' },
  { id: 'nutrition',    label: 'Nutrition & Diet',     icon: '🥗' },
  { id: 'style',        label: 'Style & Appearance',   icon: '👗' },
  { id: 'social',       label: 'Social & Confidence',  icon: '🌟' },
  { id: 'finance',      label: 'Money & Finance',      icon: '💰' },
]

const CAT_COLOR = { physical:'var(--gold)', mental:'#a78bfa', appearance:'#f472b6', growth:'#4ade80', mindfulness:'#60a5fa' }

export default function GlowUp() {
  const { user, apiFetch } = useAuth()
  const [loading,    setLoading]    = useState(true)
  const [profile,    setProfile]    = useState(null)
  const [todayData,  setTodayData]  = useState(null)
  const [stats,      setStats]      = useState(null)
  const [posts,      setPosts]      = useState([])
  const [tab,        setTab]        = useState('today')

  // onboarding
  const [step,       setStep]       = useState(1)
  const [gender,     setGender]     = useState('')
  const [ageRange,   setAgeRange]   = useState('')
  const [focusAreas, setFocusAreas] = useState([])
  const [goal,       setGoal]       = useState('')
  const [generating, setGenerating] = useState(false)

  // posts
  const [showForm,   setShowForm]   = useState(false)
  const [postTitle,  setPostTitle]  = useState('')
  const [postBody,   setPostBody]   = useState('')
  const [posting,    setPosting]    = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await apiFetch('/glowup/profile')
      setProfile(data.profile)
      if (data.profile?.setup_complete) {
        const [today, statsData, postsData] = await Promise.all([
          apiFetch('/glowup/today'),
          apiFetch('/glowup/stats'),
          apiFetch('/glowup/posts'),
        ])
        setTodayData(today)
        setStats(statsData)
        setPosts(postsData)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleSetup() {
    if (!goal.trim() || focusAreas.length === 0) return
    setGenerating(true)
    try {
      await apiFetch('/glowup/setup', { method: 'POST', body: JSON.stringify({ gender, age_range: ageRange, goals: goal, focus_areas: focusAreas }) })
      await load()
    } catch (e) { console.error(e) }
    setGenerating(false)
  }

  async function toggleHabit(id, done) {
    setTodayData(prev => {
      const next = prev.habits.map(h => h.id === id ? { ...h, completed: !done } : h)
      return { ...prev, habits: next, completion: Math.round((next.filter(h => h.completed).length / next.length) * 100) }
    })
    try { await apiFetch('/glowup/log', { method: 'POST', body: JSON.stringify({ habit_id: id, completed: !done }) }) } catch {}
  }

  async function submitPost() {
    if (!postBody.trim()) return
    setPosting(true)
    try {
      await apiFetch('/glowup/posts', { method: 'POST', body: JSON.stringify({ title: postTitle, content: postBody }) })
      setPostBody(''); setPostTitle(''); setShowForm(false)
      setPosts(await apiFetch('/glowup/posts'))
    } catch {}
    setPosting(false)
  }

  async function deletePost(id) {
    try { await apiFetch(`/glowup/posts/${id}`, { method: 'DELETE' }); setPosts(p => p.filter(x => x.id !== id)) } catch {}
  }

  if (loading) return <div className="loading"><div className="spinner" /> Loading your glow up...</div>

  // ── ONBOARDING ────────────────────────────────────────────────────────────
  if (!profile?.setup_complete) return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontFamily: 'var(--ff-display)', color: 'var(--gold)', fontSize: '2rem', marginBottom: 6 }}>✨ Glow Up</h1>
      <p style={{ color: 'var(--text3)', marginBottom: 28 }}>Let's build your personal plan — from 0 to ∞.</p>

      {/* step dots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {[1,2,3].map(s => <div key={s} style={{ height: 4, flex: 1, borderRadius: 2, background: s <= step ? 'var(--gold)' : 'var(--bg3)', transition: 'background 0.3s' }} />)}
      </div>

      {step === 1 && (
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontFamily: 'var(--ff-display)', marginBottom: 24, fontSize: '1.4rem' }}>Who are you? 👤</h2>
          <p style={{ color: 'var(--text3)', fontSize: '0.75rem', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Gender</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
            {['Male','Female','Non-binary','Prefer not to say'].map(g => (
              <div key={g} onClick={() => setGender(g)} style={{ padding: '12px 10px', borderRadius: 10, border: `1px solid ${gender===g?'var(--gold)':'var(--border)'}`, background: gender===g?'rgba(232,184,109,0.1)':'var(--bg3)', cursor: 'pointer', textAlign: 'center', color: gender===g?'var(--gold)':'var(--text2)', fontSize: '0.9rem', transition: 'all 0.2s' }}>{g}</div>
            ))}
          </div>
          <p style={{ color: 'var(--text3)', fontSize: '0.75rem', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Age Range</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 32 }}>
            {['13-17','18-22','23-27','28+'].map(a => (
              <div key={a} onClick={() => setAgeRange(a)} style={{ padding: '12px 4px', borderRadius: 10, border: `1px solid ${ageRange===a?'var(--gold)':'var(--border)'}`, background: ageRange===a?'rgba(232,184,109,0.1)':'var(--bg3)', cursor: 'pointer', textAlign: 'center', color: ageRange===a?'var(--gold)':'var(--text2)', fontSize: '0.85rem' }}>{a}</div>
            ))}
          </div>
          <button className="btn btn-gold" disabled={!gender||!ageRange} onClick={() => setStep(2)} style={{ width: '100%', justifyContent: 'center', padding: 14 }}>Next →</button>
        </div>
      )}

      {step === 2 && (
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontFamily: 'var(--ff-display)', marginBottom: 6, fontSize: '1.4rem' }}>What do you want to work on? 🎯</h2>
          <p style={{ color: 'var(--text3)', fontSize: '0.85rem', marginBottom: 24 }}>Pick everything — this is your full glow up.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 28 }}>
            {FOCUS_AREAS.map(area => {
              const sel = focusAreas.includes(area.id)
              return (
                <div key={area.id} onClick={() => setFocusAreas(p => sel ? p.filter(a => a!==area.id) : [...p, area.id])}
                  style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${sel?'var(--gold)':'var(--border)'}`, background: sel?'rgba(232,184,109,0.1)':'var(--bg3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s' }}>
                  <span style={{ fontSize: '1.1rem' }}>{area.icon}</span>
                  <span style={{ color: sel?'var(--gold)':'var(--text2)', fontSize: '0.82rem', fontWeight: sel?600:400 }}>{area.label}</span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => setStep(1)} style={{ flex: 1, justifyContent: 'center' }}>← Back</button>
            <button className="btn btn-gold" disabled={focusAreas.length===0} onClick={() => setStep(3)} style={{ flex: 2, justifyContent: 'center', padding: 14 }}>Next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontFamily: 'var(--ff-display)', marginBottom: 6, fontSize: '1.4rem' }}>Your dream self 🔥</h2>
          <p style={{ color: 'var(--text3)', fontSize: '0.85rem', marginBottom: 20 }}>Describe who you want to become — make everyone doubt it's the same person.</p>
          <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={3}
            placeholder="e.g. I want to be disciplined, fit, mentally unbreakable and completely transformed"
            style={{ width: '100%', padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', resize: 'none', fontSize: '0.95rem', marginBottom: 24, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline" onClick={() => setStep(2)} style={{ flex: 1, justifyContent: 'center' }}>← Back</button>
            <button className="btn btn-gold" disabled={!goal.trim()||generating} onClick={handleSetup} style={{ flex: 2, justifyContent: 'center', padding: 14 }}>
              {generating ? '✨ Building your plan...' : 'Build my plan ✨'}
            </button>
          </div>
          {generating && <p style={{ color: 'var(--text3)', fontSize: '0.8rem', textAlign: 'center', marginTop: 16 }}>AI is crafting your personalized glow up habits...</p>}
        </div>
      )}
    </div>
  )

  // ── MAIN SCREEN ───────────────────────────────────────────────────────────
  const grouped = {}
  if (todayData?.habits) for (const h of todayData.habits) { if (!grouped[h.category]) grouped[h.category] = []; grouped[h.category].push(h) }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--ff-display)', color: 'var(--gold)', fontSize: '2rem' }}>✨ Glow Up</h1>
        {stats != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>{stats.score}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Glow Score</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 10, padding: 4, marginBottom: 24, gap: 4 }}>
        {[['today','📋 Today'],['progress','📈 Progress'],['posts','✨ Posts']].map(([t,label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '9px 4px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 500, background: tab===t?'var(--bg2)':'transparent', color: tab===t?'var(--text)':'var(--text3)', border: tab===t?'1px solid var(--border)':'1px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* TODAY */}
      {tab === 'today' && todayData && (
        <div>
          <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg3)" strokeWidth="8" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--gold)" strokeWidth="8"
                  strokeDasharray={`${2*Math.PI*34}`}
                  strokeDashoffset={`${2*Math.PI*34*(1-todayData.completion/100)}`}
                  strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 700, color: 'var(--gold)' }}>{todayData.completion}%</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: '1.1rem', marginBottom: 4 }}>
                {todayData.completion===100?'🔥 Perfect day!':todayData.completion>=50?'💪 Keep going!':'Let\'s get it!'}
              </div>
              <div style={{ color: 'var(--text3)', fontSize: '0.85rem' }}>{todayData.habits.filter(h=>h.completed).length} of {todayData.habits.length} habits done</div>
            </div>
          </div>

          {Object.entries(grouped).map(([cat, catHabits]) => (
            <div key={cat} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.72rem', color: CAT_COLOR[cat]||'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, fontWeight: 600 }}>{cat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {catHabits.map(h => (
                  <div key={h.id} onClick={() => toggleHabit(h.id, h.completed)} className="card"
                    style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${h.completed?'var(--gold)':'var(--border)'}`, background: h.completed?'var(--gold)':'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                      {h.completed && <span style={{ color: 'var(--bg)', fontSize: '0.7rem', fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: '1.2rem' }}>{h.icon}</span>
                    <span style={{ flex: 1, color: h.completed?'var(--text3)':'var(--text)', textDecoration: h.completed?'line-through':'none', fontSize: '0.93rem' }}>{h.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PROGRESS */}
      {tab === 'progress' && stats && (
        <div>
          <div className="card" style={{ padding: 28, textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '4.5rem', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--ff-display)', lineHeight: 1 }}>{stats.score}</div>
            <div style={{ color: 'var(--text3)', marginBottom: 16, marginTop: 4 }}>Glow Score — last 30 days</div>
            <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stats.score}%`, background: 'linear-gradient(90deg, var(--gold), #f97316)', borderRadius: 4, transition: 'width 1s' }} />
            </div>
            <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text3)' }}>
              {stats.score >= 80 ? '🔥 You\'re glowing!' : stats.score >= 50 ? '💪 Making real progress' : stats.score >= 20 ? '🌱 Building momentum' : '⚡ Start your streak today'}
            </div>
          </div>

          <h3 style={{ fontFamily: 'var(--ff-display)', marginBottom: 16 }}>Habit Streaks 🔥</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.habits.sort((a,b) => b.streak - a.streak).map(h => (
              <div key={h.id} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: '1.3rem' }}>{h.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{h.name}</div>
                  <div style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>{h.total} total completions</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: h.streak>0?'#f97316':'var(--text3)', fontWeight: 700, fontSize: '1.1rem' }}>{h.streak>0?`${h.streak} 🔥`:'—'}</div>
                  <div style={{ color: 'var(--text3)', fontSize: '0.7rem' }}>day streak</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* POSTS */}
      {tab === 'posts' && (
        <div>
          {!showForm ? (
            <button className="btn btn-gold" onClick={() => setShowForm(true)} style={{ width: '100%', justifyContent: 'center', marginBottom: 20, padding: 14 }}>✨ Share your progress</button>
          ) : (
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <input value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Title (optional)"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', marginBottom: 10, boxSizing: 'border-box', fontSize: '0.9rem' }} />
              <textarea value={postBody} onChange={e => setPostBody(e.target.value)} rows={3} placeholder="Share your win, transformation, or motivation..."
                style={{ width: '100%', padding: 14, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', resize: 'none', fontSize: '0.93rem', marginBottom: 14, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline" onClick={() => setShowForm(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                <button className="btn btn-gold" onClick={submitPost} disabled={posting||!postBody.trim()} style={{ flex: 2, justifyContent: 'center' }}>{posting?'Posting...':'Post ✨'}</button>
              </div>
            </div>
          )}

          {posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>✨</div>
              <p>No posts yet. Share your first glow up win!</p>
            </div>
          ) : posts.map(post => (
            <div key={post.id} className="card" style={{ padding: 20, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div className="avatar" style={{ width: 38, height: 38, fontSize: '0.9rem', background: post.avatar_color||'var(--gold)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {post.author_photo ? <img src={post.author_photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : post.author_name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem' }}>{post.author_name}</div>
                  <div style={{ color: 'var(--text3)', fontSize: '0.73rem' }}>{new Date(post.created_at).toLocaleDateString()}</div>
                </div>
                {Number(post.user_id) === user?.id && (
                  <button onClick={() => deletePost(post.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '1rem' }}>🗑</button>
                )}
              </div>
              {post.title && <div style={{ fontFamily: 'var(--ff-display)', color: 'var(--gold)', marginBottom: 8 }}>{post.title}</div>}
              {post.content && <div style={{ color: 'var(--text2)', fontSize: '0.9rem', lineHeight: 1.6 }}>{post.content}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
