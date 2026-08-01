import { Navigate } from 'react-router-dom'
import { CommunityUsersManager } from '../components/CommunityUsersManager'
import { SubAdminsManager } from '../components/SubAdminsManager'
import { useApp } from '../context/AppContext'
import { isSuperAdmin } from '../lib/roles'

// Супер Админ: управување со подадмини + influencer/community корисници.
export function AdminCommunityPage() {
  const { auth, t } = useApp()
  if (!isSuperAdmin(auth.role)) return <Navigate to='/home' replace />

  return (
    <div className='space-y-5'>
      <div>
        <h1 className='font-display text-2xl font-bold text-slate-900'>{t('adminComm.title')}</h1>
        <p className='text-sm text-slate-500'>{t('adminComm.subtitle')}</p>
      </div>
      <SubAdminsManager />
      <CommunityUsersManager />
    </div>
  )
}
