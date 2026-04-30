import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)
const API = import.meta.env.VITE_API_URL || '/api'

// Storage helpers — sessionStorage = gone when browser closes, localStorage = persists
function saveToken(token, remember) {
  if (remember) {
    localStorage.setItem('bond_token', token)
    localStorage.setItem('bond_remember', 'true')
    sessionStorage.removeItem('bond_token')
  } else {
    sessionStorage.setItem('bond_token', token)
    localStorage.removeItem('bond_token')
    localStorage.removeItem('bond_remember')
  }
}

function getToken() {
  return localStorage.getItem('bond_token') || sessionStorage.getItem('bond_token')
}

function clearToken() {
  localStorage.removeItem('bond_token')
  localStorage.removeItem('bond_remember')
  sessionStorage.removeItem('bond_token')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const token = getToken()
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
        clearToken()
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
    // Register always remembers (new account)
    saveToken(data.token, true)
    setUser(data.user)
    return data.user
  }

  async function login(email, password, remember = true) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    saveToken(data.token, remember)
    setUser(data.user)
    return data.user
  }

  async function connectFriend(invite_code) {
    const token = getToken()
    const res = await fetch(`${API}/auth/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ invite_code: invite_code.toUpperCase().trim() })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setUser(data.user)
    return data.user
  }

  function logout() {
    clearToken()
    setUser(null)
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function apiFetch(path, options = {}) {
    const token = getToken()
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
