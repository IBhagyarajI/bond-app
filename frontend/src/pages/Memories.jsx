import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const EMOJIS = ['✨','❤️','🎉','🌍','🍕','☕','🎵','🌅','🏔️','🎮','📚','🌊','🌸','🎭','🤣']
const MAX_FILES = 6

async function uploadToCloudinary(file, cloudName, uploadPreset, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'bond-memories')
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded/e.total*100)) }
    xhr.onload = () => { const d = JSON.parse(xhr.responseText); if (xhr.status===200) resolve(d); else reject(new Error(d.error?.message||'Upload failed')) }
    xhr.onerror = () => reject(new Error('Network error'))
    xhr.send(formData)
  })
}

function isVideo(url) {
  if (!url) return false
  return url.match(/\.(mp4|mov|webm|avi|mkv)$/i) || url.includes('/video/')
}

export default function Memories() {
  const { apiFetch, showToast, user } = useAuth()
  const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title:'', description:'', files:[], memory_date:'', emoji:'✨' })
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try { const data = await apiFetch('/memories'); setMemories(data) } catch {}
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleFileChange(e) {
    const picked = Array.from(e.target.files)
    const remaining = MAX_FILES - form.files.length
    if (remaining <= 0) { showToast(`Max ${MAX_FILES} files per memory`, 'error'); return }
    const toAdd = picked.slice(0, remaining).map(file => {
      const maxMB = file.type.startsWith('video/') ? 100 : 10
      if (file.size > maxMB * 1024 * 1024) { showToast(`${file.name} too large (max ${maxMB}MB)`, 'error'); return null }
      return { file, preview: URL.createObjectURL(file) }
    }).filter(Boolean)
    set('files', [...form.files, ...toAdd])
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(idx) { set('files', form.files.filter((_,i) => i !== idx)) }

  function resetModal() {
    form.files.forEach(f => { try { URL.revokeObjectURL(f.preview) } catch {} })
    setShowModal(false)
    setForm({ title:'', description:'', files:[], memory_date:'', emoji:'✨' })
    setUploadProgress({})
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      showToast('Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to Vercel settings', 'error')
      return
    }
    setSaving(true)
    try {
      const media = []
      for (let i = 0; i < form.files.length; i++) {
        const { file } = form.files[i]
        setUploadProgress(p => ({ ...p, [i]: 1 }))
        const result = await uploadToCloudinary(file, CLOUD_NAME, UPLOAD_PRESET, pct => setUploadProgress(p => ({ ...p, [i]: pct })))
        media.push({ url: result.secure_url, type: file.type.startsWith('video/') ? 'video' : 'image' })
        setUploadProgress(p => ({ ...p, [i]: 100 }))
      }
      const memory = await apiFetch('/memories', {
        method: 'POST',
        body: JSON.stringify({ title:form.title, description:form.description, emoji:form.emoji, memory_date:form.memory_date, images: media.map(m=>m.url), media: JSON.stringify(media) })
      })
      setMemories(m => [memory, ...m])
      showToast('Memory saved! 📸')
      resetModal()
    } catch (err) { showToast('Failed: ' + err.message, 'error') }
    setSaving(false)
    setUploadProgress({})
  }

  async function handleDelete(id) {
    if (!confirm('Delete this memory?')) return
    try { await apiFetch(`/memories/${id}`, { method:'DELETE' }); setMemories(m => m.filter(x => x.id !== id)); showToast('Removed') }
    catch (err) { showToast(err.message, 'error') }
  }

  function downloadFile(url) {
    const a = document.createElement('a'); a.href = url; a.download = 'bond-memory-' + Date.now(); a.target = '_blank'; a.click()
  }

  if (!user?.friend_id) return (<div><h2 className="page-title">Memories</h2><div className="empty-state"><div className="empty-icon">📸</div><h3>Bond with your friend first</h3></div></div>)

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="page-title">Memories</h2>
          <p style={{ color:'var(--text2)', fontSize:'0.9rem' }}>{memories.length} moment{memories.length!==1?'s':''} captured together</p>
        </div>
        <button className="btn btn-gold" onClick={() => setShowModal(true)}>+ Add Memory</button>
      </div>

      {loading ? (<div className="loading"><div className="spinner"/> Loading...</div>)
      : memories.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📸</div><h3>No memories yet</h3><p>Start capturing your first moment!</p>
          <button className="btn btn-gold" style={{marginTop:'20px'}} onClick={() => setShowModal(true)}>Add first memory</button>
        </div>
      ) : (
        <div className="grid-3">
          {memories.map(m => {
            let mediaItems = []
            try { mediaItems = JSON.parse(m.media || m.images || '[]') } catch { mediaItems = [] }
            if (!Array.isArray(mediaItems)) mediaItems = []
            mediaItems = mediaItems.map(item => typeof item === 'string' ? { url:item, type: isVideo(item)?'video':'image' } : item)
            const first = mediaItems[0]
            return (
              <div key={m.id} className="memory-card">
                {first ? (
                  <div style={{ position:'relative', cursor:'pointer' }} onClick={() => setLightbox({ items:mediaItems, index:0 })}>
                    {first.type === 'video' ? (
                      <div style={{ position:'relative' }}>
                        <video src={first.url} style={{ width:'100%', height:'180px', objectFit:'cover', display:'block' }} muted/>
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.3)' }}>
                          <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'rgba(255,255,255,0.9)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>▶</div>
                        </div>
                      </div>
                    ) : (<img src={first.url} alt={m.title} className="memory-img"/>)}
                    {mediaItems.length > 1 && (
                      <div style={{ position:'absolute', bottom:'8px', right:'8px', background:'rgba(0,0,0,0.65)', color:'white', borderRadius:'50px', padding:'3px 10px', fontSize:'0.7rem' }}>
                        +{mediaItems.length-1} {mediaItems.slice(1).some(i=>i.type==='video')?'📹':'📷'}
                      </div>
                    )}
                  </div>
                ) : (<div className="memory-img-placeholder">{m.emoji}</div>)}
                <div className="memory-body">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div className="memory-title">{m.title}</div>
                    {Number(m.created_by) === user.id && (<button onClick={() => handleDelete(m.id)} style={{ color:'var(--text3)', fontSize:'0.8rem', background:'none', border:'none', cursor:'pointer', paddingLeft:'8px' }}>✕</button>)}
                  </div>
                  {m.description && <p className="memory-desc">{m.description}</p>}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'10px' }}>
                    <span className="memory-date">{m.memory_date}</span>
                    <span style={{ fontSize:'0.75rem', color:'var(--text3)' }}>by {m.creator_name}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:300, padding:'20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ position:'relative', maxWidth:'90vw', width:'100%', display:'flex', flexDirection:'column', alignItems:'center' }}>
            <button onClick={() => setLightbox(null)} style={{ position:'absolute', top:'-40px', right:0, background:'rgba(255,255,255,0.1)', border:'none', color:'white', width:'32px', height:'32px', borderRadius:'50%', cursor:'pointer', fontSize:'1rem' }}>✕</button>
            {lightbox.items[lightbox.index]?.type === 'video' ? (
              <video src={lightbox.items[lightbox.index].url} controls autoPlay style={{ maxWidth:'100%', maxHeight:'65vh', borderRadius:'12px', display:'block', background:'#000' }}/>
            ) : (
              <img src={lightbox.items[lightbox.index]?.url} alt="" style={{ maxWidth:'100%', maxHeight:'65vh', borderRadius:'12px', display:'block', objectFit:'contain' }}/>
            )}
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginTop:'14px' }}>
              {lightbox.items.length > 1 && (
                <button onClick={() => setLightbox(l => ({ ...l, index:(l.index-1+l.items.length)%l.items.length }))} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'white', width:'36px', height:'36px', borderRadius:'50%', cursor:'pointer', fontSize:'1.3rem' }}>‹</button>
              )}
              <button onClick={() => downloadFile(lightbox.items[lightbox.index]?.url)} style={{ background:'var(--gold)', border:'none', color:'#0d0d14', padding:'8px 20px', borderRadius:'50px', cursor:'pointer', fontSize:'0.8rem', fontWeight:600 }}>⬇ Download</button>
              {lightbox.items.length > 1 && (
                <button onClick={() => setLightbox(l => ({ ...l, index:(l.index+1)%l.items.length }))} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'white', width:'36px', height:'36px', borderRadius:'50%', cursor:'pointer', fontSize:'1.3rem' }}>›</button>
              )}
            </div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:'0.75rem', marginTop:'8px' }}>{lightbox.index+1} / {lightbox.items.length} · click outside to close</div>
            {lightbox.items.length > 1 && (
              <div style={{ display:'flex', gap:'8px', marginTop:'12px', flexWrap:'wrap', justifyContent:'center' }}>
                {lightbox.items.map((item, i) => (
                  <div key={i} onClick={() => setLightbox(l => ({ ...l, index:i }))} style={{ width:'52px', height:'52px', borderRadius:'8px', overflow:'hidden', cursor:'pointer', border: lightbox.index===i?'2px solid var(--gold)':'2px solid transparent', opacity:lightbox.index===i?1:0.5, position:'relative' }}>
                    {item.type==='video' ? (<><video src={item.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted/><div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.3)', fontSize:'0.8rem' }}>▶</div></>) : (<img src={item.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD MEMORY MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && resetModal()}>
          <div className="modal" style={{ maxWidth:'520px' }}>
            <h3 className="modal-title">Capture a Memory</h3>
            <form onSubmit={handleAdd}>
              <div className="form-stack">
                <div className="input-group">
                  <label className="label">Emoji</label>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    {EMOJIS.map(em => (<button type="button" key={em} onClick={() => set('emoji',em)} style={{ fontSize:'1.3rem', padding:'7px', border:`2px solid ${form.emoji===em?'var(--gold)':'var(--border)'}`, borderRadius:'8px', background:form.emoji===em?'var(--gold-dim)':'var(--bg3)', cursor:'pointer' }}>{em}</button>))}
                  </div>
                </div>
                <div className="input-group">
                  <label className="label">Title *</label>
                  <input type="text" placeholder="e.g. That rainy coffee afternoon" value={form.title} onChange={e => set('title',e.target.value)} required/>
                </div>
                <div className="input-group">
                  <label className="label">Description</label>
                  <textarea placeholder="Tell the story..." value={form.description} onChange={e => set('description',e.target.value)} rows={2}/>
                </div>
                <div className="input-group">
                  <label className="label">Photos & Videos (up to {MAX_FILES})</label>
                  {form.files.length > 0 && (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'8px', marginBottom:'10px' }}>
                      {form.files.map((f,i) => (
                        <div key={i} style={{ position:'relative', borderRadius:'8px', overflow:'hidden', aspectRatio:'1', background:'var(--bg3)' }}>
                          {f.file.type.startsWith('video/') ? (<><video src={f.preview} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted/><div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.3)', fontSize:'1.2rem' }}>▶</div></>) : (<img src={f.preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>)}
                          {uploadProgress[i] !== undefined && uploadProgress[i] < 100 && (
                            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                              <div style={{ color:'white', fontSize:'1rem', fontWeight:600 }}>{uploadProgress[i]}%</div>
                              <div style={{ width:'70%', height:'4px', background:'rgba(255,255,255,0.2)', borderRadius:'2px', marginTop:'6px' }}><div style={{ width:`${uploadProgress[i]}%`, height:'100%', background:'var(--gold)', borderRadius:'2px' }}/></div>
                            </div>
                          )}
                          {uploadProgress[i] === 100 && (<div style={{ position:'absolute', top:'4px', left:'4px', background:'var(--sage)', borderRadius:'50%', width:'20px', height:'20px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', color:'white' }}>✓</div>)}
                          <button type="button" onClick={() => removeFile(i)} style={{ position:'absolute', top:'4px', right:'4px', background:'rgba(0,0,0,0.65)', color:'white', border:'none', borderRadius:'50%', width:'22px', height:'22px', cursor:'pointer', fontSize:'0.75rem' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {form.files.length < MAX_FILES && (
                    <div onClick={() => fileRef.current?.click()} style={{ border:'2px dashed var(--border)', borderRadius:'var(--radius-sm)', padding:'20px', textAlign:'center', cursor:'pointer', background:'var(--bg3)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='var(--gold)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
                      <div style={{ fontSize:'1.8rem', marginBottom:'6px' }}>📷 🎥</div>
                      <div style={{ color:'var(--text2)', fontSize:'0.82rem' }}>Click to add photos or videos</div>
                      <div style={{ color:'var(--text3)', fontSize:'0.72rem', marginTop:'4px' }}>Images up to 10MB · Videos up to 100MB · {MAX_FILES-form.files.length} slot{MAX_FILES-form.files.length!==1?'s':''} left</div>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={handleFileChange} style={{ display:'none' }}/>
                </div>
                <div className="input-group">
                  <label className="label">Date</label>
                  <input type="date" value={form.memory_date} onChange={e => set('memory_date',e.target.value)} max={new Date().toISOString().split('T')[0]}/>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={resetModal} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-gold" disabled={saving}>{saving?<><div className="spinner" style={{width:14,height:14}}/> Uploading...</>:'Save Memory'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
