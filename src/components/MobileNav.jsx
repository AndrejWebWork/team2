import { useLocation, useNavigate } from 'react-router-dom'
import { navItems } from './navConfig'
import { cx } from '../utils/ui'
import { useApp } from '../context/AppContext'
import { isAdminRole, isSuperAdmin } from '../lib/roles'

function clearTapFocus(e) {
  const el = e.currentTarget
  requestAnimationFrame(() => el.blur())
}

export function MobileNav({ role }) {
  const { t } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const visible = navItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin(role)) return false
    if (item.adminOnly && !isAdminRole(role)) return false
    if (item.hideForAdmin && isAdminRole(role) && !(item.allowSuperAdmin && isSuperAdmin(role))) return false
    if (item.hideFromMobile) return false
    return true
  })
  const cols = Math.min(visible.length, 5)

  return (
    <nav
      className='app-chrome app-mobile-nav fixed inset-x-0 bottom-0 z-[1200] border-t border-slate-200 bg-white lg:hidden'
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className='mx-auto grid max-w-xl' style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {visible.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.to
            || (item.to !== '/' && location.pathname.startsWith(`${item.to}/`))
          return (
            <button
              key={item.to}
              type='button'
              // button (не <a href>) — Android/iOS не нуди „Copy link" / share URL
              onClick={() => navigate(item.to)}
              onPointerUp={clearTapFocus}
              onContextMenu={(e) => e.preventDefault()}
              aria-current={isActive ? 'page' : undefined}
              className={cx(
                'relative flex flex-col items-center gap-0.5 px-0.5 py-2 text-[11px] font-semibold leading-tight text-center transition-colors duration-150',
                item.to === '/air' && '-translate-x-[7px]',
                isActive ? 'text-emerald-500' : 'text-slate-500 active:text-emerald-400 hover:text-emerald-400',
              )}
            >
              <span
                aria-hidden='true'
                className={cx(
                  'absolute -top-1.5 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-b-full bg-emerald-500 transition-all duration-200',
                  isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
                )}
              />
              <item.icon className='h-[21px] w-[21px]' />
              {t(item.labelKey)}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
