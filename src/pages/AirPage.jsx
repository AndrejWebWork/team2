import { Capacitor } from '@capacitor/core'
import { Flame, Info, Loader2, MapPin, Wind, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AirMap } from '../components/AirMap'
import { EmptyState } from '../components/EmptyState'
import { InfoTip } from '../components/InfoTip'
import { ReportShortcutButton } from '../components/ReportShortcutButton'
import { StatusBadge } from '../components/StatusBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { fetchPulseSensors, NOT_MODIFIED, peekPulseSensors } from '../lib/api'
import { getDeviceId } from '../lib/device'
import { findNearestAirSensor, haversineKm } from '../lib/geo'
import { isMyReport } from '../lib/reportOwnership'
import { canAccessReportType } from '../lib/roles'
import { fetchSkopjeSensors } from '../lib/waqi'

// Колку често се освежуваат мерењата во живо од WAQI (референтни МЖСПП + граѓански).
const AIR_REFRESH_MS = 20 * 1000

function hasPulseEco(list) {
  return (list || []).some((s) => {
    const id = String(s?.id || '')
    return id.startsWith('PULSE-') && !id.startsWith('PULSE-SC-')
  })
}

function aqiMeaningKey(key) {
  if (key === 'moderate') return 'air.meaningModerate'
  if (key === 'unhealthy') return 'air.meaningUnhealthy'
  return 'air.meaningGood'
}

function aqiColor(aqi) {
  if (aqi >= 101) return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', bar: '#ef4444', key: 'unhealthy' }
  if (aqi >= 51) return { bg: '#fffbeb', border: '#fde68a', text: '#d97706', bar: '#f59e0b', key: 'moderate' }
  return { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', bar: '#22c55e', key: 'good' }
}

// Преведено име на сензор: познатите станици имаат nameKey → t('sensor.st.<key>');
// граѓанските (непознати) го задржуваат суровото име (сопствено име на место).
function sensorName(s, t) {
  return s.nameKey ? t(`sensor.st.${s.nameKey}`) : s.name
}

function SensorCard({ sensor, selected, onClick, t }) {
  const c = aqiColor(sensor.aqi)
  return (
    <button
      type='button'
      onClick={onClick}
      className='w-full rounded-2xl border p-4 text-left transition-all duration-150 hover:shadow-md'
      style={{ background: c.bg, borderColor: selected ? c.bar : c.border }}
    >
      <div className='flex items-start justify-between gap-2'>
        <div>
          <p className='text-sm font-bold text-slate-800'>{sensorName(sensor, t)}</p>
          <p className='text-xs text-slate-500'>{sensorName(sensor, t)}</p>
        </div>
        <div className='flex flex-col items-end'>
          <span className='text-2xl font-extrabold leading-none' style={{ color: c.text }}>{sensor.aqi}</span>
          <span className='text-[10px] font-semibold' style={{ color: c.text }}>AQI</span>
        </div>
      </div>
      <div className='mt-3 space-y-1.5'>
        <div>
          <div className='mb-0.5 flex justify-between text-[10px] text-slate-500'>
            <span>PM2.5</span><span>{sensor.pm25} µg/m³</span>
          </div>
          <div className='h-1.5 w-full overflow-hidden rounded-full bg-slate-200'>
            <div className='h-full rounded-full transition-all duration-500' style={{ width: `${Math.min(sensor.pm25 / 75 * 100, 100)}%`, background: c.bar }} />
          </div>
        </div>
        <div>
          <div className='mb-0.5 flex justify-between text-[10px] text-slate-500'>
            <span>PM10</span><span>{sensor.pm10} µg/m³</span>
          </div>
          <div className='h-1.5 w-full overflow-hidden rounded-full bg-slate-200'>
            <div className='h-full rounded-full transition-all duration-500' style={{ width: `${Math.min(sensor.pm10 / 150 * 100, 100)}%`, background: c.bar }} />
          </div>
        </div>
      </div>
      <div className='mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold' style={{ background: c.border, color: c.text }}>
        <Wind className='h-2.5 w-2.5' />{t(`aqi.${c.key}`)}
      </div>
    </button>
  )
}

function SensorDetail({ sensor, onClose, t }) {
  const c = aqiColor(sensor.aqi)
  return (
    <div className='rounded-xl border p-3 transition-all duration-200 sm:rounded-2xl sm:p-5' style={{ background: c.bg, borderColor: c.border }}>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-bold text-slate-900 sm:text-lg'>{sensorName(sensor, t)}</p>
          <p className='text-[11px] text-slate-500 sm:text-sm'>{t(`aqi.${c.key}`)}</p>
          <p className='mt-1 text-[11px] leading-snug text-slate-600 sm:text-xs'>{t(aqiMeaningKey(c.key))}</p>
        </div>
        <div className='shrink-0 text-right'>
          <p className='text-2xl font-extrabold leading-none sm:text-4xl' style={{ color: c.text }}>{sensor.aqi}</p>
          <p className='text-[10px] font-semibold sm:text-xs' style={{ color: c.text }}>AQI · {t(`aqi.${c.key}`)}</p>
        </div>
      </div>
      <div className='mt-2.5 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3'>
        {[['PM2.5', sensor.pm25, 75, t('air.allowedPm25')], ['PM10', sensor.pm10, 150, t('air.allowedPm10')]].map(([label, val, max, hint]) => (
          <div key={label} className='rounded-lg border bg-white/80 px-2.5 py-2 sm:rounded-xl sm:bg-white sm:p-3' style={{ borderColor: c.border }}>
            <p className='text-[10px] font-semibold text-slate-500 sm:text-xs'>{label}</p>
            <p className='text-base font-bold text-slate-900 sm:mt-1 sm:text-2xl'>
              {val ?? '—'} <span className='text-[10px] font-normal text-slate-400 sm:text-xs'>µg/m³</span>
            </p>
            {val != null && (
              <div className='mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 sm:mt-2 sm:h-2'>
                <div className='h-full rounded-full' style={{ width: `${Math.min(val / max * 100, 100)}%`, background: c.bar }} />
              </div>
            )}
            <p className='mt-1 text-[10px] leading-snug text-slate-500'>{label === 'PM2.5' ? t('air.pm25Short') : t('air.pm10Short')}</p>
            <p className='mt-0.5 text-[10px] text-slate-400'>{hint}</p>
          </div>
        ))}
      </div>
      <button type='button' onClick={onClose} className='mt-2 text-[11px] text-slate-400 hover:text-slate-600 sm:mt-3 sm:text-xs'>{t('common.closeUp')}</button>
    </div>
  )
}

export function AirPage() {
  const { sensors, setSensors, smellAlerts, auth, refreshReports, t } = useApp()
  // Иста GPS логика како Home / пријави — useGeolocation насекаде.
  const loc = useGeolocation(t)
  const userLocation = loc.lat != null && loc.lng != null
    ? { lat: loc.lat, lng: loc.lng }
    : null
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedSensor, setSelectedSensor] = useState(null)
  // Нереферентни (граѓански) сензори: WAQI граѓански + Pulse.eco во живо.
  // Само реални податоци — почнува празно и се полни од API при првото вчитување.
  const [pulse, setPulse] = useState(peekPulseSensors)
  // Статус на живото вчитување: 'loading' | 'live' | 'offline'.
  const [airStatus, setAirStatus] = useState('loading')

  useEffect(() => {
    refreshReports()
  }, [refreshReports])

  const isSmellAdmin = canAccessReportType(auth.role, 'smell')
  const mySmellReports = useMemo(() => {
    const mine = isSmellAdmin ? smellAlerts : smellAlerts.filter((r) => isMyReport(r, auth, getDeviceId()))
    return mine.filter((r) => r.status !== 'resolved')
  }, [smellAlerts, isSmellAdmin, auth.email, auth.userId, auth.isAnonymous])

  // Реални мерења во живо од WAQI (aqicn.org) + Pulse.eco:
  //  • официјални/референтни (МЖСПП) → context `sensors`,
  //  • информативни/нереферентни: граѓански (WAQI) + Pulse.eco → `pulse`.
  // Се освежува на ~3 мин и се паузира кога табот е скриен.
  useEffect(() => {
    let cancelled = false
    let timer = null
    const controller = new AbortController()

    let loadInFlight = false
    let queued = false
    let sawPulseEco = false
    async function load() {
      if (loadInFlight) {
        queued = true
        return
      }
      loadInFlight = true
      try {
      // Трите извори се НЕЗАВИСНИ: пад на еден (пр. WAQI) не смее да ги блокира
      // другите (Pulse.eco, Град Скопје). Секој се вчитува паралелно.
      const [waqiRes, pulseRes] = await Promise.allSettled([
        fetchSkopjeSensors(controller.signal),
        fetchPulseSensors(controller.signal),
      ])
      if (cancelled) return
      const valid = (s) => s.lat != null && s.lng != null && (s.aqi != null || s.pm25 != null || s.pm10 != null)
      const waqi = waqiRes.status === 'fulfilled' ? waqiRes.value : []
      const pulseLive = pulseRes.status === 'fulfilled' && pulseRes.value !== NOT_MODIFIED
        ? pulseRes.value.filter(valid)
        : null

      const referent = waqi.filter((s) => s.category === 'referent' && valid(s))
      const civic = waqi.filter((s) => s.category !== 'referent' && valid(s))
      if (waqiRes.status === 'fulfilled') setSensors(referent)
      let mergedHasEco = sawPulseEco
      setPulse((prev) => {
        const nextCivic = waqiRes.status === 'fulfilled'
          ? civic
          : prev.filter((s) => String(s.id).startsWith('WAQI-'))
        const incomingEco = hasPulseEco(pulseLive)
        const keptPulse = incomingEco || !hasPulseEco(prev)
          ? (pulseLive && pulseLive.length > 0 ? pulseLive : prev.filter((s) => String(s.id).startsWith('PULSE-')))
          : prev.filter((s) => String(s.id).startsWith('PULSE-'))
        if (waqiRes.status !== 'fulfilled' && pulseLive == null) return prev
        const seen = new Set()
        const next = [...nextCivic, ...keptPulse].filter((s) => {
          if (seen.has(s.id)) return false
          seen.add(s.id)
          return true
        })
        mergedHasEco = hasPulseEco(next)
        return next
      })
      sawPulseEco = mergedHasEco || hasPulseEco(pulseLive)

      const waqiHas = waqiRes.status === 'fulfilled' && referent.length > 0
      if (mergedHasEco || waqiHas || sawPulseEco) setAirStatus('live')
      } finally {
        loadInFlight = false
        if (queued && !cancelled) {
          queued = false
          load()
        }
      }
    }

    const schedule = () => { timer = setTimeout(tick, AIR_REFRESH_MS) }
    async function tick() {
      if (!document.hidden) await load()
      schedule()
    }
    const onVisibility = () => { if (!document.hidden) load() }

    load()
    schedule()
    // Додека ги нема Pulse Eco, прашувај на секои 3s — независно од бавно прво барање.
    const ecoTimer = setInterval(() => {
      if (!cancelled && !sawPulseEco) load()
    }, 3000)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      controller.abort()
      if (timer) clearTimeout(timer)
      clearInterval(ecoTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [setSensors])

  const allSensors = useMemo(() => [...sensors, ...pulse], [sensors, pulse])

  // Најблизок сензор по воздушна линија (Haversine) — сите референтни + граѓански.
  const nearestResult = useMemo(
    () => (userLocation ? findNearestAirSensor(userLocation.lat, userLocation.lng, allSensors) : null),
    [allSensors, userLocation],
  )
  const nearest = nearestResult?.sensor ?? null

  const visibleMinistrySensors = useMemo(
    () => (sourceFilter === 'all' || sourceFilter === 'ministry' ? sensors : []),
    [sensors, sourceFilter],
  )
  const visiblePulseSensors = useMemo(
    () => (sourceFilter === 'all' || sourceFilter === 'pulse' ? pulse : []),
    [pulse, sourceFilter],
  )
  const civicCardSensors = useMemo(
    () => pulse.filter((s) => !String(s.id).startsWith('PULSE-')),
    [pulse],
  )
  const pulseEcoCount = useMemo(
    () => pulse.filter((s) => hasPulseEco([s])).length,
    [pulse],
  )
  const visibleCount = visibleMinistrySensors.length + visiblePulseSensors.length

  return (
    <div className='space-y-6'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h1 className='font-display text-2xl font-bold text-slate-900'>{t('air.title')}</h1>
          <p className='mt-0.5 text-sm text-slate-500'>{t('air.subtitle')}</p>
        </div>
        {airStatus === 'loading' ? (
          <span className='inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500'>
            <Loader2 className='h-3 w-3 animate-spin' />{t('air.loadingLive')}
          </span>
        ) : airStatus === 'live' ? (
          <span className='inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'>
            <span className='relative flex h-2 w-2'>
              <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75' />
              <span className='relative inline-flex h-2 w-2 rounded-full bg-emerald-500' />
            </span>
            {t('air.live')}
          </span>
        ) : (
          <span className='inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700'>
            <span className='h-2 w-2 rounded-full bg-amber-500' />{t('air.offline')}
          </span>
        )}
      </div>

      <div className='flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600'>
        <Info className='mt-0.5 h-4 w-4 shrink-0 text-slate-400' aria-hidden />
        <div className='space-y-2'>
          <p>{t('air.sensorDisclaimer1')}</p>
          <p>{t('air.sensorDisclaimer2')}</p>
        </div>
      </div>

      {/* Без реален GPS нема „најблизок сензор" — јасна порака наместо лажна близина. */}
      {!userLocation && !loc.loading && (
        <div className='rounded-2xl border border-slate-200 bg-slate-50 p-5'>
          <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>{t('air.nearestSensor')}</p>
          <div className='mt-2 flex flex-wrap items-center gap-3'>
            <p className='flex items-center gap-2 text-sm text-slate-600'>
              <XCircle className='h-4 w-4 shrink-0 text-slate-400' />
              {loc.error || t('air.locationUnavailable')}
            </p>
            <button
              type='button'
              onClick={() => loc.retry()}
              className='ml-auto flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100'
            >
              <MapPin className='h-3.5 w-3.5' />{Capacitor.isNativePlatform() ? t('gps.retry2') : t('gps.webRetry')}
            </button>
          </div>
          {!Capacitor.isNativePlatform() && (
            <ol className='mt-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-slate-600'>
              <li>{t('gps.webStep1')}</li>
              <li>{t('gps.webStep2')}</li>
              <li>{t('gps.webStep3')}</li>
              <li>{t('gps.webStep4')}</li>
            </ol>
          )}
        </div>
      )}

      {nearest && (() => {
        const c = aqiColor(nearest.aqi)
        const distKm = nearestResult ? nearestResult.distanceM / 1000 : haversineKm(userLocation, nearest)
        return (
          <div className='rounded-2xl border p-5' style={{ background: c.bg, borderColor: c.border }}>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide' style={{ color: c.text }}>{t('air.nearestSensor')}</p>
                <p className='mt-0.5 text-xl font-bold text-slate-900'>{sensorName(nearest, t)}</p>
                <p className='text-sm text-slate-500'>{sensorName(nearest, t)} &middot; {distKm < 1 ? `${nearestResult?.distanceM ?? Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`} {t('air.fromYou')}</p>
              </div>
              <div className='text-right'>
                <p className='text-5xl font-extrabold leading-none' style={{ color: c.text }}>{nearest.aqi}</p>
                <p className='mt-0.5 text-xs font-semibold' style={{ color: c.text }}>AQI &middot; {t(`aqi.${c.key}`)}</p>
              </div>
            </div>
            <p className='mt-2 text-sm leading-snug text-slate-700'>{t(aqiMeaningKey(c.key))}</p>
            <div className='mt-4 grid grid-cols-2 gap-2'>
              {[['PM2.5', nearest.pm25, 'µg/m³', t('air.pm25Short')], ['PM10', nearest.pm10, 'µg/m³', t('air.pm10Short')]].map(([label, val, unit, hint]) => (
                <div key={label} className='rounded-xl bg-white/60 px-3 py-2'>
                  <p className='text-xs text-slate-500'>{label}</p>
                  <p className='text-lg font-bold text-slate-800'>{val} <span className='text-xs font-normal text-slate-400'>{unit}</span></p>
                  <p className='mt-0.5 text-[11px] leading-snug text-slate-500'>{hint}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Selected sensor detail panel */}
      {selectedSensor && (
        <SensorDetail sensor={selectedSensor} onClose={() => setSelectedSensor(null)} t={t} />
      )}

      {/* Официјални / референтни сензори (МЖСПП) */}
      <section className='space-y-3'>
        <div className='flex items-center gap-2'>
          <span className='h-2.5 w-2.5 shrink-0 rounded-full border-2 border-sky-500 bg-sky-300' />
          <div>
            <div className='flex items-center gap-2'>
              <h2 className='text-base font-bold text-slate-900'>{t('air.officialTitle')}</h2>
              <InfoTip label={t('air.officialTitle')}>{t('air.officialInfo')}</InfoTip>
            </div>
            <p className='text-xs text-slate-500'>{t('air.officialSubtitle')}</p>
          </div>
        </div>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {sensors.map((s) => (
            <SensorCard
              key={s.id}
              sensor={s}
              selected={selectedSensor?.id === s.id}
              onClick={() => setSelectedSensor(selectedSensor?.id === s.id ? null : s)}
              t={t}
            />
          ))}
        </div>
      </section>

      {/* Информативни / нереферентни сензори (Pulse Eco + граѓански WAQI) */}
      <section className='space-y-3'>
        <div className='flex items-center gap-2'>
          <span className='h-2.5 w-2.5 shrink-0 rounded-full border-2 border-emerald-500 bg-emerald-300' />
          <div>
            <div className='flex items-center gap-2'>
              <h2 className='text-base font-bold text-slate-900'>{t('air.informativeTitle')}</h2>
              <InfoTip label={t('air.informativeTitle')}>{t('air.informativeInfo')}</InfoTip>
            </div>
            <p className='text-xs text-slate-500'>{t('air.informativeSubtitle')}</p>
          </div>
        </div>
        <p className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500'>
          {t('air.nonreferentInfo1')}{t('air.nonreferentInfo2')}
        </p>
        {pulse.length > 0 ? (
          <>
            {civicCardSensors.length > 0 && (
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {civicCardSensors.map((s) => (
                <SensorCard
                  key={s.id}
                  sensor={s}
                  selected={selectedSensor?.id === s.id}
                  onClick={() => setSelectedSensor(selectedSensor?.id === s.id ? null : s)}
                  t={t}
                />
              ))}
            </div>
            )}
            {pulseEcoCount > 0 && (
              <p className='text-xs text-slate-500'>
                {pulseEcoCount} Pulse Eco · {t('air.sensorsOnMap')}
              </p>
            )}
          </>
        ) : airStatus === 'offline' ? (
          <p className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500'>
            {t('air.offline')}
          </p>
        ) : (
          <p className='rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700'>
            {t('air.loadingLive')}
          </p>
        )}
      </section>

      {/* Map */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <MapPin className='h-4 w-4 text-sky-500' />{t('air.sensorsOnMap')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1'>
            {[['all', t('filter.all')], ['ministry', t('air.filterMinistry')], ['pulse', 'Pulse Eco']].map(([val, label]) => (
              <button
                key={val}
                type='button'
                onClick={() => setSourceFilter(val)}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                  sourceFilter === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className='app-map-shell'>
            <AirMap
              ministrySensors={visibleMinistrySensors}
              pulseSensors={visiblePulseSensors}
              userLocation={userLocation}
            />
          </div>
          <div className='flex flex-wrap items-center gap-3 text-xs text-slate-500'>
            <span className='flex items-center gap-1.5'>
              {/* Примерот во легендата е ЖИВА вредност од прва референтна станица. */}
              <span className='flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[8px] font-extrabold leading-none text-white shadow ring-1 ring-emerald-200'>{sensors[0]?.aqi ?? ''}</span>
              {t('air.legendReferent')}
            </span>
              <span className='flex items-center gap-1.5'>
                <span className='inline-flex h-5 w-4 items-end justify-center' aria-hidden>
                  <svg width='12' height='16' viewBox='0 0 32 42'><path d='M16 40.5S28 26.2 28 16.2A12 12 0 1 0 4 16.2C4 26.2 16 40.5 16 40.5z' fill='#22c55e' stroke='#fff' strokeWidth='2'/></svg>
                </span>
                {t('air.legendNonreferent')}
              </span>
            <span className='ml-auto'>{t('air.shownLabel')}: {visibleCount} / {allSensors.length}</span>
          </div>
        </CardContent>
      </Card>

      <section className='rounded-2xl border border-slate-200 bg-white p-4'>
        <h2 className='text-sm font-bold text-slate-900'>{t('air.learnTitle')}</h2>
        <p className='mt-1 text-xs leading-relaxed text-slate-600'>{t('air.learnAqi')}</p>
        <ul className='mt-2 space-y-1 text-xs leading-relaxed'>
          <li className='text-emerald-800'>{t('air.learnGood')}</li>
          <li className='text-amber-800'>{t('air.learnModerate')}</li>
          <li className='text-rose-800'>{t('air.learnUnhealthy')}</li>
        </ul>
        <div className='mt-3 grid gap-2 sm:grid-cols-2'>
          <div className='rounded-xl bg-slate-50 px-3 py-2.5'>
            <p className='text-xs font-semibold text-slate-800'>PM2.5</p>
            <p className='mt-1 text-xs leading-relaxed text-slate-600'>{t('air.learnPm25')}</p>
          </div>
          <div className='rounded-xl bg-slate-50 px-3 py-2.5'>
            <p className='text-xs font-semibold text-slate-800'>PM10</p>
            <p className='mt-1 text-xs leading-relaxed text-slate-600'>{t('air.learnPm10')}</p>
          </div>
        </div>
        <p className='mt-3 text-[11px] leading-relaxed text-slate-500'>{t('air.learnLimits')}</p>
      </section>

      <section className='space-y-3'>
        <div className='flex items-center justify-between gap-3'>
          <h2 className='text-lg font-semibold text-slate-900'>{isSmellAdmin ? t('waste.activeAdmin') : t('waste.activeMine')}</h2>
          <p className='text-xs text-slate-500'>{mySmellReports.length} {t('common.records')}</p>
        </div>
        {mySmellReports.length === 0 ? (
          <EmptyState
            title={isSmellAdmin ? t('waste.noActiveAdmin') : t('waste.noActiveMine')}
            description={isSmellAdmin ? t('waste.noActiveAdminDesc') : t('waste.noActiveMineDesc')}
          />
        ) : (
          <div className='grid gap-3 md:grid-cols-2'>
            {mySmellReports.map((alert) => (
              <article key={alert.id} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                <div className='flex items-start justify-between gap-2'>
                  <p className='flex items-center gap-1.5 font-semibold text-slate-900'>
                    <MapPin className='h-4 w-4 shrink-0 text-rose-500' />{alert.location || t('admin.unknownLocation')}
                  </p>
                  <StatusBadge status={alert.status || 'pending'} />
                </div>
                {alert.intensity != null && (
                  <div className='mt-2 flex items-center gap-1'>
                    {[1, 2, 3, 4, 5].map((n) => <Flame key={n} className='h-4 w-4' style={{ fill: alert.intensity >= n ? '#fb923c' : 'none', color: alert.intensity >= n ? '#ea580c' : '#cbd5e1' }} />)}
                    <span className='ml-1 text-xs text-slate-500'>{alert.intensity}/5</span>
                  </div>
                )}
                {alert.message && <p className='mt-2 text-sm text-slate-600'>{alert.message}</p>}
                <p className='mt-2 text-xs text-slate-400'>
                  {alert.createdAt
                    ? new Date(alert.createdAt).toLocaleString('mk-MK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : ''}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Smell report shortcut → Home with smell type pre-selected */}
      <Card className='border-rose-100 bg-gradient-to-br from-white to-rose-50/40'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Flame className='h-4 w-4 text-rose-500' />{t('air.reportSmell')}
          </CardTitle>
          <CardDescription>{t('air.reportSmellHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportShortcutButton reportType='smell' className='w-full' />
        </CardContent>
      </Card>

    </div>
  )
}
