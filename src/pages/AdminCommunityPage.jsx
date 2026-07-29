import { Navigate } from 'react-router-dom'
import { CommunityUsersManager } from '../components/CommunityUsersManager'
import { useApp } from '../context/AppContext'
import { isSuperAdmin } from '../lib/roles'

// Посебна админ страница за управување со influencer/community корисници —
// достапна само за Супер Админ.
export function AdminCommunityPage() {
  const { auth, t } = useApp()
  if (!isSuperAdmin(auth.role)) return <Navigate to='/home' replace />

  return (
    <div className='space-y-5'>
      <div>
        <h1 className='font-display text-2xl font-bold text-slate-900'>{t('adminComm.title')}</h1>
        <p className='text-sm text-slate-500'>{t('adminComm.subtitle')}</p>
      </div>
      <CommunityUsersManager />
    </div>
  )
}
