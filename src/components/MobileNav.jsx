import { NavLink } from 'react-router-dom'
import { navItems } from './navConfig'
import { cx } from '../utils/ui'
import { useApp } from '../context/AppContext'

export function MobileNav({ role }) {
  const { t } = useApp()
  const visible = navItems.filter((item) => {
    if (item.adminOnly && role !== 'admin') return false
    if (item.hideForAdmin && role === 'admin') return false
    if (item.hideFromMobile) return false
    return true
  })
  const cols = Math.min(visible.length, 5)

  return (
    <nav className='fixed inset-x-0 bottom-0 z-[1200] border-t border-slate-200 bg-white pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3 lg:hidden'>
      <div className='mx-auto grid max-w-xl' style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {visible.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cx(
              'relative flex flex-col items-center gap-1 px-0.5 py-2 text-[11px] font-semibold leading-tight text-center transition-colors duration-150',
              // Оптичка корекција: „Воздух" малку влево за визуелно порамнет ред.
              item.to === '/air' && '-translate-x-[7px]',
              isActive ? 'text-emerald-500' : 'text-slate-500 hover:text-emerald-400',
            )}
          >
            {({ isActive }) => (
              <>
                {/* Индикатор линија над активната ставка (само мобилен navbar) */}
                <span
                  aria-hidden='true'
                  className={cx(
                    'absolute -top-3 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-b-full bg-emerald-500 transition-all duration-200',
                    isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
                  )}
                />
                <item.icon className='h-[22px] w-[22px]' />
                {t(item.labelKey)}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
