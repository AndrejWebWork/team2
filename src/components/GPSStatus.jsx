import { CheckCircle2, Loader2, MapPin, Settings, XCircle } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { formatAccuracyMeters } from '../lib/geolocation'

export function GPSStatus({ loc, onRetry, onRefresh, t }) {
  const accuracyLabel = formatAccuracyMeters(loc.accuracy, t)
  const lowAccuracy = loc.isDesktop && loc.accuracy != null && loc.accuracy > 400
  const native = Capacitor.isNativePlatform()
  const handleRefresh = onRefresh || onRetry
  const openSettings = native && (loc.denied || loc.servicesOff)

  if (loc.loading) {
    return (
      <div className='space-y-2'>
        <div className='flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500'>
          <Loader2 className='h-4 w-4 animate-spin text-slate-400' />
          {loc.isDesktop ? t('gps.refining') : t('gps.requesting')}
        </div>
        {loc.isDesktop && (
          <p className='text-xs text-slate-500'>{t('gps.desktopHint')}</p>
        )}
      </div>
    )
  }

  if (loc.error) {
    return (
      <div className='space-y-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3'>
        <div className='flex items-start gap-2 text-sm text-rose-700'>
          <XCircle className='mt-0.5 h-4 w-4 shrink-0' />
          <span>{loc.error}</span>
        </div>
        {loc.isDesktop && !loc.denied && (
          <p className='text-xs text-rose-600/90'>{t('gps.desktopHint')}</p>
        )}
        {openSettings && (
          <p className='text-xs text-rose-600/90'>{t('gps.openSettingsHint')}</p>
        )}
        <button
          type='button'
          onClick={onRetry}
          className='flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50'
        >
          {openSettings ? <Settings className='h-4 w-4' /> : <MapPin className='h-4 w-4' />}
          {openSettings
            ? t('gps.retryOpenSettings')
            : (loc.denied ? t('gps.retryDenied') : t('gps.retry'))}
        </button>
      </div>
    )
  }

  return (
    <div className='space-y-2'>
      <div className='flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700'>
        <CheckCircle2 className='h-4 w-4 shrink-0' />
        <span className='font-medium'>{t('gps.captured')}</span>
        <span className='min-w-0 flex-1 truncate text-xs text-emerald-600 opacity-80'>{loc.label}</span>
        {accuracyLabel && (
          <span className='shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800'>
            {accuracyLabel}
          </span>
        )}
        <button
          type='button'
          onClick={handleRefresh}
          className='shrink-0 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100'
        >
          {t('gps.refresh')}
        </button>
      </div>
      {loc.isDesktop && loc.lat != null && (
        <p className='text-[11px] tabular-nums text-slate-400'>
          {Number(loc.lat).toFixed(5)}, {Number(loc.lng).toFixed(5)}
        </p>
      )}
      {lowAccuracy && (
        <p className='text-xs text-amber-700'>{t('gps.desktopLowAccuracy')}</p>
      )}
    </div>
  )
}
