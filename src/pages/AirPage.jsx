import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Flame, Info, Loader2, MapPin, Wind, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet'
import { MapLayers } from '../components/MapLayers'
import { ReportShortcutButton } from '../components/ReportShortcutButton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'
import { fetchSkopjeSensors } from '../lib/waqi'
import { fetchPulseSensors } from '../lib/api'

// Колку често се освежуваат мерењата во живо од WAQI (референтни МЖСПП + граѓански).
const AIR_REFRESH_MS = 3 * 60 * 1000

const userIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function makeSensorIcon(bg, border) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${bg};border:2.5px solid ${border};box-shadow:0 1px 4px rgba(0,0,0,0.18);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

const pulseIcon = makeSensorIcon('#34d399', '#10b981')

// Официјалните МЖСПП станици: значка со живата AQI вредност, обоена според
// квалитетот (зелена/жолта/црвена), со покажувач кон точната локација.
// Многу поинформативно од обичен син круг — вредноста се чита директно на мапата.
const AQI_PIN = {
  good: { bg: '#22c55e', ring: '#dcfce7' },
  moderate: { bg: '#f59e0b', ring: '#fef3c7' },
  unhealthy: { bg: '#ef4444', ring: '#fee2e2' },
}

// Кеш по AQI вредност — иста референца меѓу рендери (Capacitor WebView
// често „губи“ маркери ако секој poll прави нов L.divIcon).
const aqiIconCache = new Map()

function makeAqiIcon(aqi) {
  const n = Number.isFinite(Number(aqi)) ? Math.round(Number(aqi)) : null
  const cacheKey = n == null ? 'na' : String(n)
  const cached = aqiIconCache.get(cacheKey)
  if (cached) return cached

  const level = n == null ? 'good' : n >= 101 ? 'unhealthy' : n >= 51 ? 'moderate' : 'good'
  const c = AQI_PIN[level]
  const label = n == null ? '—' : String(n)
  // Без CSS filter:drop-shadow — Android/iOS WebView често не го црта (празни пинови).
  const icon = L.divIcon({
    className: 'aqi-map-pin',
    html: `
      <div style="position:relative;width:34px;height:42px;">
        <div style="
          width:34px;height:34px;border-radius:50%;
          background:${c.bg};border:3px solid #ffffff;
          box-shadow:0 0 0 2px ${c.ring},0 2px 6px rgba(15,23,42,0.35);
          display:flex;align-items:center;justify-content:center;
          color:#ffffff;font-weight:800;font-size:${n != null && n >= 100 ? 11 : 13}px;
          font-family:system-ui,-apple-system,sans-serif;line-height:1;
        ">${label}</div>
        <div style="
          position:absolute;left:50%;bottom:1px;transform:translateX(-50%);
          width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
          border-top:8px solid #ffffff;
        "></div>
      </div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 42],
    popupAnchor: [0, -40],
  })
  aqiIconCache.set(cacheKey, icon)
  return icon
}

import { findNearestAirSensor, haversineKm, resolveLocationLabel } from '../lib/geo'
import {
  captureGeolocation,
  captureGeolocationWithRetries,
  geoErrorMessage,
  openNativeLocationSettings,
} from '../lib/geolocation'
import { Capacitor } from '@capacitor/core'
function RecenterMap({ lat, lng }) {
  const map = useMap()
  const centered = useRef(false)
  useEffect(() => {
    if (centered.current || lat == null || lng == null) return
    centered.current = true
    map.setView([lat, lng], 13)
  }, [lat, lng, map])
  return null
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
            <p className='mt-1 hidden text-[10px] text-slate-400 sm:block'>{hint}</p>
          </div>
        ))}
      </div>
      <button type='button' onClick={onClose} className='mt-2 text-[11px] text-slate-400 hover:text-slate-600 sm:mt-3 sm:text-xs'>{t('common.closeUp')}</button>
    </div>
  )
}

export function AirPage() {
  const { sensors, setSensors, smellAlerts, auth, t } = useApp()
  // Реалната GPS локација на корисникот. null додека не е добиена (или одбиена)
  // — никогаш не се користи измислена/фиксна локација како замена.
  const [userLocation, setUserLocation] = useState(null)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedSensor, setSelectedSensor] = useState(null)
  const [gps, setGps] = useState({ lat: null, lng: null, label: '', loading: true, error: '', denied: false })
  // Нереферентни (граѓански) сензори: WAQI граѓански + Pulse.eco во живо.
  // Само реални податоци — почнува празно и се полни од API при првото вчитување.
  const [pulse, setPulse] = useState([])
  // Статус на живото вчитување: 'loading' | 'live' | 'offline'.
  const [airStatus, setAirStatus] = useState('loading')

  // Реални мерења во живо од WAQI (aqicn.org) + Pulse.eco:
  //  • официјални/референтни (МЖСПП) → context `sensors`,
  //  • информативни/нереферентни: граѓански (WAQI) + Pulse.eco → `pulse`.
  // Се освежува на ~3 мин и се паузира кога табот е скриен.
  useEffect(() => {
    let cancelled = false
    let timer = null
    const controller = new AbortController()

    let loadInFlight = false
    async function load() {
      if (loadInFlight) return
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
      const pulseLive = pulseRes.status === 'fulfilled' ? pulseRes.value.filter(valid) : []

      const referent = waqi.filter((s) => s.category === 'referent' && valid(s))
      const civic = waqi.filter((s) => s.category !== 'referent' && valid(s))
      if (waqiRes.status === 'fulfilled') setSensors(referent)
      setPulse((prev) => {
        const nextCivic = waqiRes.status === 'fulfilled'
          ? civic
          : prev.filter((s) => String(s.id).startsWith('WAQI-'))
        const nextPulse = pulseRes.status === 'fulfilled'
          ? (pulseLive.length > 0 ? pulseLive : prev.filter((s) => String(s.id).startsWith('PULSE-')))
          : prev.filter((s) => String(s.id).startsWith('PULSE-'))
        if (waqiRes.status !== 'fulfilled' && pulseRes.status !== 'fulfilled') return prev
        const seen = new Set()
        return [...nextCivic, ...nextPulse].filter((s) => {
          if (seen.has(s.id)) return false
          seen.add(s.id)
          return true
        })
      })

      const anyLive = waqiRes.status === 'fulfilled' || pulseRes.status === 'fulfilled'
      setAirStatus((prev) => (anyLive ? 'live' : prev === 'live' ? 'live' : 'offline'))
      } finally {
        loadInFlight = false
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
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      controller.abort()
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [setSensors])

  async function requestGPS({ attempts = 1, openSettings = false } = {}) {
    if (!navigator.geolocation && !Capacitor.isNativePlatform()) {
      setGps({ lat: null, lng: null, label: '', loading: false, error: t('gps.notSupported'), denied: false })
      return
    }
    if (openSettings && Capacitor.isNativePlatform()) {
      await openNativeLocationSettings({ denied: Boolean(gps.denied) })
    }
    setGps((g) => ({ ...g, loading: true, error: '', denied: false }))
    try {
      const pos = attempts > 1
        ? await captureGeolocationWithRetries({ attempts })
        : await captureGeolocation({ maximumAge: 0 })
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      setUserLocation({ lat, lng })
      setGps({
        lat, lng,
        label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        loading: false,
        error: '',
        denied: false,
      })
      resolveLocationLabel(lat, lng).then((label) => {
        if (!label) return
        setGps((g) => (g.lat === lat && g.lng === lng ? { ...g, label } : g))
      }).catch(() => {})
    } catch (err) {
      const denied = err?.code === 1
      setGps({
        lat: null, lng: null, label: '', loading: false, denied,
        error: denied
          ? (Capacitor.isNativePlatform() ? t('gps.deniedNative') : t('gps.deniedBrowser'))
          : geoErrorMessage(err, t),
      })
    }
  }

  useEffect(() => { requestGPS({ attempts: 3 }) }, [])

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
      {!userLocation && !gps.loading && (
        <div className='rounded-2xl border border-slate-200 bg-slate-50 p-5'>
          <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>{t('air.nearestSensor')}</p>
          <div className='mt-2 flex flex-wrap items-center gap-3'>
            <p className='flex items-center gap-2 text-sm text-slate-600'>
              <XCircle className='h-4 w-4 shrink-0 text-slate-400' />{t('air.locationUnavailable')}
            </p>
            <button
              type='button'
              onClick={() => requestGPS({ attempts: 3, openSettings: true })}
              className='ml-auto flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100'
            >
              <MapPin className='h-3.5 w-3.5' />{t('gps.retry2')}
            </button>
          </div>
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
            <div className='mt-4 grid grid-cols-2 gap-2'>
              {[['PM2.5', nearest.pm25, 'µg/m³'], ['PM10', nearest.pm10, 'µg/m³']].map(([label, val, unit]) => (
                <div key={label} className='rounded-xl bg-white/60 px-3 py-2'>
                  <p className='text-xs text-slate-500'>{label}</p>
                  <p className='text-lg font-bold text-slate-800'>{val} <span className='text-xs font-normal text-slate-400'>{unit}</span></p>
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
            <h2 className='text-base font-bold text-slate-900'>{t('air.officialTitle')}</h2>
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
            <h2 className='text-base font-bold text-slate-900'>{t('air.informativeTitle')}</h2>
            <p className='text-xs text-slate-500'>{t('air.informativeSubtitle')}</p>
          </div>
        </div>
        <p className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500'>
          {t('air.nonreferentInfo1')}{t('air.nonreferentInfo2')}
        </p>
        {pulse.length > 0 ? (
          civicCardSensors.length > 0 ? (
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
          ) : null
        ) : airStatus === 'loading' ? (
          <p className='rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700'>
            {t('air.loadingLive')}
          </p>
        ) : (
          <p className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500'>
            {t('air.offline')}
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
            {/* Почетниот поглед на мапата е Скопје (само поглед, не податок);
                маркерот „Вашата локација" се црта САМО со реален GPS. */}
            <MapContainer
              center={[41.9981, 21.4254]}
              zoom={13}
              maxZoom={20}
              className='h-full w-full'
              zoomAnimation={false}
              markerZoomAnimation={false}
              fadeAnimation={false}
              inertia={false}
            >
              {userLocation && <RecenterMap lat={userLocation.lat} lng={userLocation.lng} />}
              <MapLayers />
              {userLocation && (
                <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                  <Popup>{t('air.yourLocation')}</Popup>
                </Marker>
              )}
              {visibleMinistrySensors.map((s) => (
                <Marker
                  key={s.id}
                  position={[Number(Number(s.lat).toFixed(5)), Number(Number(s.lng).toFixed(5))]}
                  icon={makeAqiIcon(s.aqi)}
                  zIndexOffset={400}
                >
                  <Popup maxWidth={280} minWidth={160} autoPanPadding={[24, 24]} className='sensor-popup'>
                    <p className='text-[12px] font-bold leading-tight sm:text-sm'>{sensorName(s, t)}</p>
                    <p className='text-[10px] text-slate-500 sm:text-xs'>{t('air.referentSource')}</p>
                    <p className='text-[11px] sm:text-xs'>AQI: <b>{s.aqi}</b> · {t(`aqi.${aqiColor(s.aqi).key}`)}</p>
                    <p className='text-[10px] text-slate-600 sm:text-xs'>PM2.5: {s.pm25 ?? '—'} µg/m³</p>
                    <p className='text-[10px] text-slate-600 sm:text-xs'>PM10: {s.pm10 ?? '—'} µg/m³</p>
                  </Popup>
                </Marker>
              ))}
              {visiblePulseSensors.map((s) => (
                <Marker
                  key={s.id}
                  position={[Number(Number(s.lat).toFixed(5)), Number(Number(s.lng).toFixed(5))]}
                  icon={pulseIcon}
                >                  <Popup maxWidth={280} minWidth={160} autoPanPadding={[24, 24]} className='sensor-popup'>
                    <p className='text-[12px] font-bold leading-tight sm:text-sm'>{sensorName(s, t)}</p>
                    <p className='text-[10px] text-slate-500 sm:text-xs'>{t('air.pulseSensor')}</p>
                    {s.aqi != null && (
                      <p className='text-[11px] sm:text-xs'>AQI: <b>{s.aqi}</b> · {t(`aqi.${aqiColor(s.aqi).key}`)}</p>
                    )}
                    {s.pm25 != null && <p className='text-[10px] text-slate-600 sm:text-xs'>PM2.5: {s.pm25} µg/m³</p>}
                    {s.pm10 != null && <p className='text-[10px] text-slate-600 sm:text-xs'>PM10: {s.pm10} µg/m³</p>}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <div className='flex flex-wrap items-center gap-3 text-xs text-slate-500'>
            <span className='flex items-center gap-1.5'>
              {/* Примерот во легендата е ЖИВА вредност од прва референтна станица. */}
              <span className='flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-[8px] font-extrabold leading-none text-white shadow ring-1 ring-emerald-200'>{sensors[0]?.aqi ?? ''}</span>
              {t('air.legendReferent')}
            </span>
            <span className='flex items-center gap-1.5'><span className='h-2.5 w-2.5 rounded-full border-2 border-emerald-400 bg-emerald-200' />{t('air.legendNonreferent')}</span>
            <span className='ml-auto'>{t('air.shownLabel')}: {visibleCount} / {allSensors.length}</span>
          </div>
        </CardContent>
      </Card>

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

      {auth.role === 'admin' && smellAlerts.length > 0 && (
        <section className='space-y-3'>
          <h2 className='text-lg font-semibold text-slate-900'>{t('air.smellReportsTitle')}</h2>
          <div className='grid gap-3 md:grid-cols-2'>
            {smellAlerts.map((alert) => (
              <article key={alert.id} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                <div className='flex items-start justify-between gap-2'>
                  <p className='flex items-center gap-1.5 font-semibold text-slate-900'><MapPin className='h-4 w-4 shrink-0 text-rose-500' />{alert.location}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${alert.severity === 'critical' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                    {alert.severity === 'critical' ? t('severity.critical') : t('severity.warning')}
                  </span>
                </div>
                {alert.lat != null && <p className='mt-1 text-xs text-slate-400'>GPS: {Number(alert.lat).toFixed(5)}, {Number(alert.lng).toFixed(5)}</p>}
                {alert.intensity != null && (
                  <div className='mt-2 flex items-center gap-1'>
                    {[1,2,3,4,5].map((n) => <Flame key={n} className='h-4 w-4' style={{ fill: alert.intensity >= n ? '#fb923c' : 'none', color: alert.intensity >= n ? '#ea580c' : '#cbd5e1' }} />)}
                    <span className='ml-1 text-xs text-slate-500'>{alert.intensity}/5</span>
                  </div>
                )}
                <p className='mt-2 text-sm text-slate-600'>{alert.message}</p>
                <p className='mt-1 text-xs text-slate-400'>{t('air.reportedBy')} {alert.createdBy || t('common.anonymous')}</p>
              </article>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
