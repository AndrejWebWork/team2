import { Flame, Recycle, Trash2, Wind } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { homeReportPath } from '../lib/reportTypes'
import { Button } from './ui/button'

const TYPE_META = {
  smell: { icon: Wind, labelKey: 'home.typeSmell' },
  deponija: { icon: Trash2, labelKey: 'home.typeDeponija' },
  container: { icon: Recycle, labelKey: 'home.typeContainer' },
}

export function ReportShortcutButton({ reportType, className, variant = 'default', size = 'default' }) {
  const navigate = useNavigate()
  const { t } = useApp()
  const meta = TYPE_META[reportType]
  if (!meta) return null

  const Icon = meta.icon

  return (
    <Button
      type='button'
      variant={variant}
      size={size}
      className={className}
      onClick={() => navigate(homeReportPath(reportType))}
    >
      <Icon className='h-4 w-4' />
      {t('reportShortcut.goToHome', { type: t(meta.labelKey) })}
    </Button>
  )
}
