import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import AppShell from './pages/AppShell'
import Dashboard from './pages/Dashboard'
import Memories from './pages/Memories'
import BucketList from './pages/BucketList'
import CheckIn from './pages/CheckIn'
import Support from './pages/Support'
import ForgotPassword from './pages/ForgotPassword'
import Admin from './pages/Admin'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="memories" element={<Memories />} />
            <Route path="bucket" element={<BucketList />} />
            <Route path="checkin" element={<CheckIn />} />
            <Route path="support" element={<Support />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
