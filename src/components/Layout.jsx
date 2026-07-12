import { Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function Layout() {
  const { auth, unreadCount, setAuth, currentUserPoints, t } = useApp()
  const location = useLocation()

  return (
    <div className='min-h-screen bg-[#f4f6f8]'>
      <Sidebar role={auth.role} />
      <main className='flex min-h-screen flex-col pb-24 lg:ml-64 lg:pb-8'>
        <Topbar
          role={auth.role}
          unreadCount={unreadCount}
          setAuth={setAuth}
          email={auth.email}
          displayName={auth.displayName}
          isAnonymous={auth.isAnonymous}
          currentUserPoints={currentUserPoints}
          t={t}
        />
        {/* flex-1 го зазема остатокот од висината; `my-auto` вертикално ги центрира
            кратките страници, а долгите нормално се движат (без сечење горе). */}
        <div className='mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-6 pt-5 sm:px-6 md:px-8'>
          <div key={location.pathname} className='page-enter my-auto w-full'>
            <Outlet />
          </div>
        </div>
      </main>
      <MobileNav role={auth.role} />
    </div>
  )
}
