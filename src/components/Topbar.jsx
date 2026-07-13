import { Bell, Gift, LogIn, LogOut, Settings, UserCircle2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from './ui/button'

export function Topbar({ role, unreadCount, setAuth, email, displayName, isAnonymous, currentUserPoints, t }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState(false)
  const prevPathRef = useRef('/')

  // Прикажано име: полното име и презиме од регистрација; ако нема → е-пошта.
  const displayLabel = displayName?.trim() || email || t('common.anonymousCitizen')

  // Кратка пулс-анимација кога пристигнува ново известување (порасне бројот).
  const prevUnread = useRef(unreadCount)
  const [pinging, setPinging] = useState(false)
  useEffect(() => {
    if (unreadCount > prevUnread.current) {
      setPinging(true)
      const timer = setTimeout(() => setPinging(false), 900)
      prevUnread.current = unreadCount
      return () => clearTimeout(timer)
    }
    prevUnread.current = unreadCount
    return undefined
  }, [unreadCount])

  // Track previous path so double-click on bell goes back
  if (location.pathname !== '/notifications') {
    prevPathRef.current = location.pathname
  }

  function handleBellClick() {
    if (location.pathname === '/notifications') {
      navigate(prevPathRef.current || -1)
    } else {
      navigate('/notifications')
    }
  }

  function logout() {
    setAuth({ isAuthenticated: true, role: 'user', email: '', isAnonymous: true })
    navigate('/home')
    setOpenMenu(false)
  }

  const roleLabel = role === 'admin' ? t('role.adminShort') : role === 'organization' ? t('role.organization') : t('role.user')

  return (
    <>
      <header className='sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 md:px-6'>
        <div className='flex items-center justify-between'>

          {/* Mobile: avatar opens slide menu */}
          <button
            type='button'
            onClick={() => setOpenMenu(true)}
            className='rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden'
          >
            <UserCircle2 className='h-8 w-8' />
          </button>

          {/* Desktop: user info */}
          <div className='hidden items-center gap-2 lg:flex'>
            <UserCircle2 className='h-6 w-6 text-slate-400' />
            <div>
              <p className='text-sm font-semibold text-slate-800'>{displayLabel}</p>
              <p className='text-xs text-slate-400'>{roleLabel}</p>
            </div>
          </div>

          {/* Right side actions */}
          <div className='flex items-center gap-2'>
            {/* Rewards — desktop only. Без коцка: само икона + текст + „жетон"
                со поени; иконата се движи на hover за поживо чувство. */}
            <button
              onClick={() => navigate('/leaderboard')}
              aria-label={t('topbar.rewards')}
              className='group hidden items-center gap-1.5 rounded-full px-1.5 py-1.5 text-xs font-semibold text-amber-600 transition-colors hover:text-amber-700 lg:flex'
            >
              <Gift className='h-4 w-4 transition-transform duration-200 group-hover:-rotate-12 group-hover:scale-110' />
              {t('topbar.rewards')}
              <span className='rounded-full bg-gradient-to-br from-amber-400 to-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-amber-500/30'>{currentUserPoints}</span>
            </button>

            {/* Вертикален разделник — визуелно ги одвојува наградите од ѕвончето */}
            <span className='hidden h-5 w-px bg-slate-200 lg:block' />

            {/* Notifications — само ѕвонче (без рамка/коцка), покрупно на телефон */}
            <button
              onClick={handleBellClick}
              aria-label={t('topbar.notifications')}
              className='relative rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800'
            >
              <Bell className={`h-7 w-7 lg:h-5 lg:w-5 ${pinging ? 'badge-pop' : ''}`} />
              {unreadCount > 0 && (
                <span className='absolute -right-0.5 -top-0.5 flex h-[18px] w-[18px] items-center justify-center'>
                  {pinging && (
                    <span className='badge-ping absolute inline-flex h-full w-full rounded-full bg-rose-400' />
                  )}
                  <span
                    key={unreadCount}
                    className='badge-pop relative flex h-[18px] w-[18px] items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold leading-none text-white tabular-nums'
                  >
                    {unreadCount}
                  </span>
                </span>
              )}
            </button>

            {/* Login/Logout — desktop only */}
            {!isAnonymous ? (
              <Button variant='outline' size='sm' onClick={logout} className='hidden border-slate-200 text-slate-600 lg:flex'>
                <LogOut className='h-3.5 w-3.5' />{t('topbar.logout')}
              </Button>
            ) : (
              <Button
                variant='outline'
                size='sm'
                onClick={() => navigate('/login', { state: { allowLogin: true } })}
                className='hidden border-emerald-200 text-emerald-700 hover:bg-emerald-50 lg:flex'
              >
                <LogIn className='h-3.5 w-3.5' />{t('topbar.login')}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile slide menu */}
      <div className={`fixed inset-0 z-50 lg:hidden ${openMenu ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div
          className={`absolute inset-0 bg-slate-900/30 transition-opacity duration-200 ${openMenu ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setOpenMenu(false)}
        />
        <aside
          className={`absolute left-0 top-0 flex h-full w-72 flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-250 ease-out ${openMenu ? 'translate-x-0' : '-translate-x-full'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className='flex items-center justify-between border-b border-slate-200 p-4'>
            <div>
              <p className='text-sm font-semibold text-slate-900'>{displayLabel}</p>
              <p className='text-xs text-slate-400'>{roleLabel}</p>
            </div>
            <button onClick={() => setOpenMenu(false)} className='rounded-lg p-1.5 text-slate-400 hover:bg-slate-100'>
              <X className='h-4 w-4' />
            </button>
          </div>

          <div className='p-4'>
            <button
              onClick={() => { navigate('/leaderboard'); setOpenMenu(false) }}
              className='flex w-full items-center justify-between rounded-xl px-3 py-3 text-[15px] font-semibold text-amber-700 transition-colors hover:bg-amber-50'
            >
              <span className='flex items-center gap-3'><Gift className='h-5 w-5 shrink-0' />{t('topbar.rewards')}</span>
              <span className='rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold'>{currentUserPoints}</span>
            </button>

            {/* Чисти редови без рамки — како на десктоп страничното мени */}
            <div className='mt-4 space-y-0.5 border-t border-slate-100 pt-4'>
              <button
                onClick={() => { navigate('/settings'); setOpenMenu(false) }}
                className='flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900'
              >
                <Settings className='h-5 w-5 shrink-0' />{t('topbar.settings')}
              </button>

              {isAnonymous ? (
                <button
                  onClick={() => { navigate('/login', { state: { allowLogin: true } }); setOpenMenu(false) }}
                  className='flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50'
                >
                  <LogIn className='h-5 w-5 shrink-0' />{t('topbar.login')}
                </button>
              ) : (
                <button
                  onClick={logout}
                  className='flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold text-rose-600 transition-colors hover:bg-rose-50'
                >
                  <LogOut className='h-5 w-5 shrink-0' />{t('topbar.logout')}
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
