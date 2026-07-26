import { Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function Layout() {
  const { auth, unreadCount, logout, currentUserPoints, t } = useApp()
  const location = useLocation()

  // Админ страниците (панел, статистика, community корисници) користат целосна
  // ширина без центрирање — насловот и содржината почнуваат од горе-лево.
  const fullWidth = ['/admin-panel', '/admin-desk', '/admin-community'].includes(location.pathname)

  // Страници со листи (известувања, пријави, заедница) почнуваат од горе, не се
  // центрираат вертикално — така се гледаат повеќе објави и центрирањето не
  // изгледа чудно кога листата расте/се празни.
  const topAligned = fullWidth || ['/notifications', '/waste', '/community'].includes(location.pathname)

  return (
    <div className='min-h-screen bg-[#f4f6f8]'>
      <Sidebar role={auth.role} />
      <main className='flex min-h-screen flex-col pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:ml-64 lg:pb-8'>
        <Topbar
          role={auth.role}
          unreadCount={unreadCount}
          logout={logout}
          email={auth.email}
          displayName={auth.displayName}
          isAnonymous={auth.isAnonymous}
          currentUserPoints={currentUserPoints}
          t={t}
        />
        {/* flex-1 го зазема остатокот од висината; `my-auto` вертикално ги центрира
            кратките страници, а долгите нормално се движат (без сечење горе). */}
        <div className={`mx-auto flex w-full flex-1 flex-col px-4 pb-6 pt-5 sm:px-6 md:px-8 ${fullWidth ? 'max-w-none' : 'max-w-5xl'}`}>
          <div key={location.pathname} className={`page-enter w-full ${topAligned ? 'mb-auto' : 'my-auto'}`}>
            <Outlet />
          </div>
        </div>
        <footer className='mx-auto w-full max-w-5xl px-4 pb-4 pt-2 text-center sm:px-6 md:px-8'>
          <p className='text-xs text-slate-400'>{t('common.credit')}</p>
        </footer>
      </main>
      <MobileNav role={auth.role} />
    </div>
  )
}
