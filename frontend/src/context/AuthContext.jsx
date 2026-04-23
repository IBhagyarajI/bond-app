import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

const API = '/api'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem('bond_token')
    if (token) fetchMe(token)
    else setLoading(false)
  }, [])

  async function fetchMe(token) {
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        localStorage.removeItem('bond_token')
      }
    } catch {}
    setLoading(false)
  }

  async function register(name, email, password) {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    localStorage.setItem('bond_token', data.token)
    setUser(data.user)
    return data.user
  }

  async function login(email, password) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    localStorage.setItem('bond_token', data.token)
    setUser(data.user)
    return data.user
  }

  async function connectFriend(invite_code) {
    const token = localStorage.getItem('bond_token')
    const res = await fetch(`${API}/auth/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ invite_code })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setUser(data.user)
    return data.user
  }

  function logout() {
    localStorage.removeItem('bond_token')
    setUser(null)
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('bond_token')
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, register, login, logout, connectFriend, showToast, apiFetch }}>
      {children}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.message}</div>
      )}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
