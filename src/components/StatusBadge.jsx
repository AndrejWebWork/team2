import { cx } from '../utils/ui'
import { useApp } from '../context/AppContext'

// Клас-мапа по статус; лабелите доаѓаат преку i18n (sb.<status>).
const cls = {
  good:        'border-emerald-200 bg-emerald-50 text-emerald-700',
  moderate:    'border-amber-200 bg-amber-50 text-amber-700',
  unhealthy:   'border-rose-200 bg-rose-50 text-rose-700',
  pending:     'border-amber-200 bg-amber-50 text-amber-700',
  in_progress: 'border-sky-200 bg-sky-50 text-sky-700',
  resolved:    'border-emerald-200 bg-emerald-50 text-emerald-700',
  open:        'border-sky-200 bg-sky-50 text-sky-700',
  few_left:    'border-orange-200 bg-orange-50 text-orange-700',
  warning:     'border-amber-200 bg-amber-50 text-amber-700',
  critical:    'border-rose-200 bg-rose-50 text-rose-700',
}

export function StatusBadge({ status }) {
  const { t } = useApp()
  const klass = cls[status]
  return (
    <span className={cx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', klass || 'border-slate-200 bg-slate-50 text-slate-600')}>
      {klass ? t(`sb.${status}`) : String(status).replace('_', ' ')}
    </span>
  )
}
