import { AlertCircle, Biohazard, ClipboardList, LayoutDashboard, Recycle, ScrollText, Settings, UsersRound, Wind } from 'lucide-react'

// `labelKey` е i18n клуч (nav.*). Преводот се прави во Sidebar/MobileNav преку t().
// `adminOnly` — видливо за сите админ улоги
// `superAdminOnly` — само Супер Админ
// `hideForAdmin` — сокриено за сите админ улоги
export const navItems = [
  { to: '/home', labelKey: 'nav.home', icon: ClipboardList, adminOnly: false, hideForAdmin: true },
  { to: '/air', labelKey: 'nav.air', icon: Wind, hideForAdmin: true },
  { to: '/waste', labelKey: 'nav.waste', icon: Biohazard, hideForAdmin: true },
  { to: '/containers', labelKey: 'nav.containers', icon: Recycle, hideForAdmin: true },
  // Супер Админ гледа Заедница (одобрување настани); специјализираните админи — не.
  { to: '/community', labelKey: 'nav.community', icon: LayoutDashboard, hideForAdmin: true, allowSuperAdmin: true },
  { to: '/admin-panel', labelKey: 'nav.panel', icon: ClipboardList, adminOnly: true },
  { to: '/admin-desk', labelKey: 'nav.stats', icon: AlertCircle, adminOnly: true },
  { to: '/admin-community', labelKey: 'nav.communityUsers', icon: UsersRound, adminOnly: true, superAdminOnly: true },
  { to: '/impressum', labelKey: 'nav.impressum', icon: ScrollText, hideFromMobile: true },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, hideFromMobile: true },
]
