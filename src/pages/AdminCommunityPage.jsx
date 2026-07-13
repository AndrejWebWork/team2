import { Navigate } from 'react-router-dom'
import { CommunityUsersManager } from '../components/CommunityUsersManager'
import { useApp } from '../context/AppContext'

// Посебна админ страница за управување со influencer/community корисници —
// достапна од левото мени (навигација), одвоено од админ панелот со пријави.
export function AdminCommunityPage() {
  const { auth, t } = useApp()
  if (auth.role !== 'admin') return <Navigate to='/home' replace />

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
