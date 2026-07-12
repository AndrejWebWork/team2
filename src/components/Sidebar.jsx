import { NavLink } from 'react-router-dom'
import { navItems } from './navConfig'
import { cx } from '../utils/ui'
import { useApp } from '../context/AppContext'

export function Sidebar({ role }) {
  const { t } = useApp()
  const main = navItems.filter((item) => {
    if (item.adminOnly && role !== 'admin') return false
    if (item.hideForAdmin && role === 'admin') return false
    if (item.hideFromMobile) return false
    return true
  })
  const bottom = navItems.filter((item) => item.hideFromMobile)

  return (
    <aside className='hidden border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col'>
      <div className='flex flex-1 flex-col p-5'>
        <div className='relative mb-6 overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5'>
          <img
            src='/skopje-brand.png'
            alt={t('comm.skopje')}
            className='h-24 w-full object-cover'
            loading='lazy'
          />
          <div className='absolute inset-0 bg-gradient-to-t from-emerald-950/85 via-emerald-900/35 to-transparent' />
          <div className='absolute inset-x-0 bottom-0 px-4 pb-3'>
            <p className='font-display text-xl font-bold leading-tight tracking-tight text-white drop-shadow-sm'>EkoSkopje</p>
            <p className='text-[11px] font-medium text-emerald-50/90'>{t('brand.tagline')}</p>
          </div>
        </div>
        <nav className='flex-1 space-y-0.5'>
          {main.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cx(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold transition-all duration-150',
                isActive
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <item.icon className='h-5 w-5 shrink-0' />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className='mt-4 border-t border-slate-100 pt-4 space-y-0.5'>
          {bottom.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cx(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold transition-all duration-150',
                isActive
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <item.icon className='h-5 w-5 shrink-0' />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
      </div>
    </aside>
  )
}
