import { useLocation, useNavigate } from 'react-router-dom'
import { navItems } from './navConfig'
import { cx } from '../utils/ui'
import { useApp } from '../context/AppContext'
import { BRAND_SRC, GRB_SRC } from '../lib/brand'
import { isAdminRole, isSuperAdmin } from '../lib/roles'

function clearTapFocus(e) {
  const el = e.currentTarget
  requestAnimationFrame(() => el.blur())
}

function isNavVisible(item, role) {
  if (item.superAdminOnly && !isSuperAdmin(role)) return false
  if (item.adminOnly && !isAdminRole(role)) return false
  if (item.hideForAdmin && isAdminRole(role) && !(item.allowSuperAdmin && isSuperAdmin(role))) return false
  return true
}

export function Sidebar({ role }) {
  const { t } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const main = navItems.filter((item) => {
    if (!isNavVisible(item, role)) return false
    if (item.hideFromMobile) return false
    return true
  })
  const bottom = navItems.filter((item) => item.hideFromMobile && isNavVisible(item, role))

  function NavButton({ item }) {
    const isActive = location.pathname === item.to
      || (item.to !== '/' && location.pathname.startsWith(`${item.to}/`))
    return (
      <button
        type='button'
        onClick={() => navigate(item.to)}
        onPointerUp={clearTapFocus}
        onContextMenu={(e) => e.preventDefault()}
        aria-current={isActive ? 'page' : undefined}
        className={cx(
          'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-semibold transition-all duration-150',
          isActive
            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900',
        )}
      >
        <item.icon className='h-5 w-5 shrink-0' />
        {t(item.labelKey)}
      </button>
    )
  }

  return (
    <aside
      className='app-chrome hidden border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:pt-[env(safe-area-inset-top,0px)] lg:pb-[env(safe-area-inset-bottom,0px)]'
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className='app-scroll flex flex-1 flex-col p-5'>
        <div className='relative mb-6 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5'>
          <img
            src={BRAND_SRC}
            alt={t('comm.skopje')}
            className='h-24 w-full object-cover'
            loading='lazy'
            draggable={false}
          />
          <div className='absolute inset-0 bg-gradient-to-t from-emerald-950/85 via-emerald-900/35 to-transparent' />
          <div className='absolute inset-x-0 bottom-0 flex items-end gap-2.5 px-3 pb-3'>
            <img
              src={GRB_SRC}
              alt={t('brand.coatAlt')}
              className='h-12 w-auto shrink-0 drop-shadow-md'
              draggable={false}
            />
            <div className='min-w-0 pb-0.5'>
              <p className='font-display text-xl font-bold leading-tight tracking-tight text-white drop-shadow-sm'>Еко Скопје</p>
              <p className='text-[11px] font-medium text-emerald-50/90'>{t('brand.tagline')}</p>
            </div>
          </div>
        </div>
        <nav className='flex-1 space-y-0.5'>
          {main.map((item) => <NavButton key={item.to} item={item} />)}
        </nav>
        <div className='mt-4 space-y-0.5 border-t border-slate-100 pt-4'>
          {bottom.map((item) => <NavButton key={item.to} item={item} />)}
        </div>
      </div>
    </aside>
  )
}
