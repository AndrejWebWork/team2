import { AlertCircle, Biohazard, ClipboardList, LayoutDashboard, Recycle, Settings, Wind } from 'lucide-react'

// `labelKey` е i18n клуч (nav.*). Преводот се прави во Sidebar/MobileNav преку t().
export const navItems = [
  { to: '/home', labelKey: 'nav.home', icon: ClipboardList, adminOnly: false, hideForAdmin: true },
  { to: '/air', labelKey: 'nav.air', icon: Wind, hideForAdmin: true },
  { to: '/waste', labelKey: 'nav.waste', icon: Biohazard, hideForAdmin: true },
  { to: '/containers', labelKey: 'nav.containers', icon: Recycle, hideForAdmin: true },
  { to: '/community', labelKey: 'nav.community', icon: LayoutDashboard, hideForAdmin: true },
  { to: '/admin-panel', labelKey: 'nav.panel', icon: ClipboardList, adminOnly: true },
  { to: '/admin-desk', labelKey: 'nav.stats', icon: AlertCircle, adminOnly: true },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, hideFromMobile: true },
]
