import { Navigate, Route, Routes } from 'react-router-dom'
import { CookieConsent } from './components/CookieConsent'
import { Layout } from './components/Layout'
import { useApp } from './context/AppContext'
import { AdminCommunityPage } from './pages/AdminCommunityPage'
import { AdminDeskPage } from './pages/AdminDeskPage'
import { AdminPanelPage } from './pages/AdminPanelPage'
import { AirPage } from './pages/AirPage'
import { AuthLoadingPage } from './pages/AuthLoadingPage'
import { CommunityPage } from './pages/CommunityPage'
import { ContainersPage } from './pages/ContainersPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { HomePage } from './pages/HomePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { ImpressumPage } from './pages/ImpressumPage'
import { LegalPage } from './pages/LegalPage'
import { LoginPage } from './pages/LoginPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SettingsPage } from './pages/SettingsPage'
import { WastePage } from './pages/WastePage'

function ProtectedLayout() {
  const { auth } = useApp()
  if (!auth.isAuthenticated) return <Navigate to='/auth-loading' replace />
  return <Layout />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path='/' element={<Navigate to='/home' replace />} />
        <Route path='/auth-loading' element={<AuthLoadingPage />} />
        <Route path='/login' element={<LoginPage />} />
        <Route path='/forgot-password' element={<ForgotPasswordPage />} />
        <Route path='/reset-password' element={<ResetPasswordPage />} />
        <Route path='/legal' element={<LegalPage />} />
        <Route path='/impressum' element={<ImpressumPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path='/home' element={<HomePage />} />
          <Route path='/admin-panel' element={<AdminPanelPage />} />
          <Route path='/air' element={<AirPage />} />
          <Route path='/waste' element={<WastePage />} />
          <Route path='/containers' element={<ContainersPage />} />
          <Route path='/community' element={<CommunityPage />} />
          <Route path='/notifications' element={<NotificationsPage />} />
          <Route path='/leaderboard' element={<LeaderboardPage />} />
          <Route path='/admin-desk' element={<AdminDeskPage />} />
          <Route path='/admin-community' element={<AdminCommunityPage />} />
          <Route path='/settings' element={<SettingsPage />} />
        </Route>
        <Route path='*' element={<Navigate to='/home' replace />} />
      </Routes>
      {/* Согласност за колачиња/кеш при прво отворање (линк до /legal). */}
      <CookieConsent />
    </>
  )
}
