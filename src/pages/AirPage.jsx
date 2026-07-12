import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CheckCircle2, Flame, Loader2, MapPin, Wind, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet'
import { MapLayers } from '../components/MapLayers'
import { SubmitSuccessModal } from '../components/SubmitSuccessModal'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { useApp } from '../context/AppContext'
import { fetchSkopjeSensors } from '../lib/waqi'
import { fetchCitySensors, fetchPulseSensors } from '../lib/api'

// Колку често се освежуваат мерењата во живо од WAQI (референтни МЖСПП + граѓански).
const AIR_REFRESH_MS = 15000

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
const cityIcon = makeSensorIcon('#a78bfa', '#8b5cf6')

// Официјалните МЖСПП станици: значка со живата AQI вредност, обоена според
// квалитетот (зелена/жолта/црвена), со покажувач кон точната локација.
// Многу поинформативно од обичен син круг — вредноста се чита директно на мапата.
const AQI_PIN = {
  good: { bg: '#22c55e', ring: '#dcfce7' },
  moderate: { bg: '#f59e0b', ring: '#fef3c7' },
  unhealthy: { bg: '#ef4444', ring: '#fee2e2' },
}

function makeAqiIcon(aqi) {
  const level = aqi >= 101 ? 'unhealthy' : aqi >= 51 ? 'moderate' : 'good'
  const c = AQI_PIN[level]
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:34px;height:42px;filter:drop-shadow(0 2px 4px rgba(15,23,42,0.35));">
        <div style="
          width:34px;height:34px;border-radius:50%;
          background:${c.bg};border:3px solid #ffffff;box-shadow:0 0 0 2px ${c.ring};
          display:flex;align-items:center;justify-content:center;
          color:#ffffff;font-weight:800;font-size:${aqi >= 100 ? 11 : 13}px;
          font-family:Inter,system-ui,sans-serif;line-height:1;
        ">${aqi}</div>
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
}

function distanceKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function RecenterMap({ center }) {
  const map = useMap()
  useEffect(() => { map.setView(center, 13) }, [center, map])
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
    <div className='rounded-2xl border p-5 transition-all duration-200' style={{ background: c.bg, borderColor: c.border }}>
      <div className='flex items-start justify-between'>
        <div>
          <p className='text-lg font-bold text-slate-900'>{sensorName(sensor, t)}</p>
          <p className='text-sm text-slate-500'>{sensorName(sensor, t)}</p>
        </div>
        <div className='text-right'>
          <p className='text-4xl font-extrabold leading-none' style={{ color: c.text }}>{sensor.aqi}</p>
          <p className='text-xs font-semibold' style={{ color: c.text }}>AQI · {t(`aqi.${c.key}`)}</p>
        </div>
      </div>
      <div className='mt-4 grid grid-cols-2 gap-3'>
        {[['PM2.5', sensor.pm25, 75, t('air.allowedPm25')], ['PM10', sensor.pm10, 150, t('air.allowedPm10')]].map(([label, val, max, hint]) => (
          <div key={label} className='rounded-xl border bg-white p-3' style={{ borderColor: c.border }}>
            <p className='text-xs font-semibold text-slate-500'>{label}</p>
            <p className='mt-1 text-2xl font-bold text-slate-900'>{val} <span className='text-xs font-normal text-slate-400'>µg/m³</span></p>
            <div className='mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100'>
              <div className='h-full rounded-full' style={{ width: `${Math.min(val / max * 100, 100)}%`, background: c.bar }} />
            </div>
            <p className='mt-1 text-[10px] text-slate-400'>{hint}</p>
          </div>
        ))}
      </div>
      <button onClick={onClose} className='mt-3 text-xs text-slate-400 hover:text-slate-600'>{t('common.closeUp')}</button>
    </div>
  )
}

export function AirPage() {
  const { sensors, setSensors, smellAlerts, auth, submitReport, t } = useApp()
  // Реалната GPS локација на корисникот. null додека не е добиена (или одбиена)
  // — никогаш не се користи измислена/фиксна локација како замена.
  const [userLocation, setUserLocation] = useState(null)
  const [sourceFilter, setSourceFilter] = useState('all')
  const [selectedSensor, setSelectedSensor] = useState(null)
  const [gps, setGps] = useState({ lat: null, lng: null, label: '', loading: true, error: '' })
  const [smellDesc, setSmellDesc] = useState('')
  const [intensity, setIntensity] = useState(3)
  const [toast, setToast] = useState('')
  const [submitted, setSubmitted] = useState(false)
  // Нереферентни (граѓански) сензори: WAQI граѓански + Pulse.eco во живо.
  // Само реални податоци — почнува празно и се полни од API при првото вчитување.
  const [pulse, setPulse] = useState([])
  // Сензори на Град Скопје (category='city') — од базата преку backend.
  // Градската мрежа (10 сензори, по 1 во општина) моментално не е активна,
  // па ова е обично празно; штом Градот внесе мерења, се прикажуваат веднаш.
  const [citySensors, setCitySensors] = useState([])
  // Статус на живото вчитување: 'loading' | 'live' | 'offline'.
  const [airStatus, setAirStatus] = useState('loading')

  // Реални мерења во живо од WAQI (aqicn.org) за Скопскиот регион:
  //  • официјални/референтни (МЖСПП) → context `sensors`,
  //  • информативни/нереферентни: граѓански (WAQI) + Pulse.eco → `pulse`,
  //  • Град Скопје (од базата) → `citySensors`.
  // Се освежува на ~AIR_REFRESH_MS и се паузира кога табот е скриен.
  useEffect(() => {
    let cancelled = false
    let timer = null
    const controller = new AbortController()

    async function load() {
      // Трите извори се НЕЗАВИСНИ: пад на еден (пр. WAQI) не смее да ги блокира
      // другите (Pulse.eco, Град Скопје). Секој се вчитува паралелно.
      const [waqiRes, pulseRes, cityRes] = await Promise.allSettled([
        fetchSkopjeSensors(controller.signal),
        fetchPulseSensors(controller.signal),
        fetchCitySensors(controller.signal),
      ])
      if (cancelled) return
      const valid = (s) => s.lat != null && s.lng != null && s.aqi != null
      const waqi = waqiRes.status === 'fulfilled' ? waqiRes.value : []
      const pulseLive = pulseRes.status === 'fulfilled' ? pulseRes.value : []
      const city = cityRes.status === 'fulfilled' ? cityRes.value : []

      const referent = waqi.filter((s) => s.category === 'referent' && valid(s))
      const civic = waqi.filter((s) => s.category !== 'referent' && valid(s))
      // Не бриши претходно прикажани сензори при привремен пад на изворот.
      if (waqiRes.status === 'fulfilled') setSensors(referent)
      if (waqiRes.status === 'fulfilled' || pulseRes.status === 'fulfilled') {
        setPulse([...civic, ...pulseLive])
      }
      if (cityRes.status === 'fulfilled') setCitySensors(city)

      const anyLive = waqiRes.status === 'fulfilled' || pulseRes.status === 'fulfilled'
      setAirStatus((prev) => (anyLive ? 'live' : prev === 'live' ? 'live' : 'offline'))
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

  function requestGPS() {
    if (!navigator.geolocation) {
      setGps({ lat: null, lng: null, label: '', loading: false, error: t('gps.notSupported') })
      return
    }
    setGps((g) => ({ ...g, loading: true, error: '' }))
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setGps({ lat, lng, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, loading: false, error: '' })
        setUserLocation({ lat, lng })
      },
      (err) => setGps({ lat: null, lng: null, label: '', loading: false, error: err.code === 1 ? t('gps.deniedBrowser') : t('gps.failed') }),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  useEffect(() => { requestGPS() }, [])

  // Најблизок сензор — САМО од реална GPS локација. Без локација нема
  // пресметка (се прикажува „локацијата не е достапна" наместо лажна близина).
  const nearest = useMemo(
    () => (userLocation
      ? [...sensors].sort((a, b) => distanceKm(userLocation, a) - distanceKm(userLocation, b))[0]
      : null),
    [sensors, userLocation],
  )

  const allSensors = useMemo(() => [...sensors, ...pulse, ...citySensors], [sensors, pulse, citySensors])
  const visibleMinistrySensors = useMemo(
    () => (sourceFilter === 'all' || sourceFilter === 'ministry' ? sensors : []),
    [sensors, sourceFilter],
  )
  const visiblePulseSensors = useMemo(
    () => (sourceFilter === 'all' || sourceFilter === 'pulse' ? pulse : []),
    [pulse, sourceFilter],
  )
  const visibleCitySensors = useMemo(
    () => (sourceFilter === 'all' || sourceFilter === 'city' ? citySensors : []),
    [citySensors, sourceFilter],
  )
  const visibleCount = visibleMinistrySensors.length + visiblePulseSensors.length + visibleCitySensors.length

  async function submitSmell(e) {
    e.preventDefault()
    if (gps.loading) return setToast(t('form.waitingLocation'))
    if (gps.lat == null) return setToast(t('form.locationUnavailable'))
    if (!smellDesc.trim()) return setToast(t('form.enterDescription'))
    await submitReport({
      type: 'smell',
      location: gps.label,
      lat: gps.lat,
      lng: gps.lng,
      description: smellDesc.trim(),
      intensity,
      severity: intensity >= 4 ? 'critical' : 'warning',
    })
    setSmellDesc('')
    setIntensity(3)
    setSubmitted(true)
  }

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
              onClick={requestGPS}
              className='ml-auto flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100'
            >
              <MapPin className='h-3.5 w-3.5' />{t('gps.retry2')}
            </button>
          </div>
        </div>
      )}

      {nearest && (() => {
        const c = aqiColor(nearest.aqi)
        const dist = distanceKm(userLocation, nearest)
        return (
          <div className='rounded-2xl border p-5' style={{ background: c.bg, borderColor: c.border }}>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide' style={{ color: c.text }}>{t('air.nearestSensor')}</p>
                <p className='mt-0.5 text-xl font-bold text-slate-900'>{sensorName(nearest, t)}</p>
                <p className='text-sm text-slate-500'>{sensorName(nearest, t)} &middot; {dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`} {t('air.fromYou')}</p>
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
      </section>

      {/* Сензори на Град Скопје */}
      <section className='space-y-3'>
        <div className='flex items-center gap-2'>
          <span className='h-2.5 w-2.5 shrink-0 rounded-full border-2 border-violet-500 bg-violet-300' />
          <div>
            <h2 className='text-base font-bold text-slate-900'>{t('air.cityTitle')}</h2>
          </div>
        </div>
        {citySensors.length > 0 ? (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {citySensors.map((s) => (
              <SensorCard
                key={s.id}
                sensor={s}
                selected={selectedSensor?.id === s.id}
                onClick={() => setSelectedSensor(selectedSensor?.id === s.id ? null : s)}
                t={t}
              />
            ))}
          </div>
        ) : (
          <p className='rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700'>
            {t('air.cityNotice')}
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
            {[['all', t('filter.all')], ['ministry', t('air.filterMinistry')], ['pulse', 'Pulse Eco'], ['city', t('air.filterCity')]].map(([val, label]) => (
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
          <div className='overflow-hidden rounded-xl border border-slate-200' style={{ height: 340 }}>
            {/* Почетниот поглед на мапата е Скопје (само поглед, не податок);
                маркерот „Вашата локација" се црта САМО со реален GPS. */}
            <MapContainer center={[41.9981, 21.4254]} zoom={13} maxZoom={20} className='h-full w-full'>
              {userLocation && <RecenterMap center={[userLocation.lat, userLocation.lng]} />}
              <MapLayers />
              {userLocation && (
                <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                  <Popup>{t('air.yourLocation')}</Popup>
                </Marker>
              )}
              {visibleMinistrySensors.map((s) => (
                <Marker key={s.id} position={[s.lat, s.lng]} icon={makeAqiIcon(s.aqi)}>
                  <Popup>
                    <p className='font-bold'>{sensorName(s, t)}</p>
                    <p className='text-xs'>{t('air.referentSource')}</p>
                    <p className='text-xs'>AQI: <b>{s.aqi}</b> · {t(`aqi.${aqiColor(s.aqi).key}`)}</p>
                    <p className='text-xs'>PM2.5: {s.pm25} µg/m³</p>
                    <p className='text-xs'>PM10: {s.pm10} µg/m³</p>
                  </Popup>
                </Marker>
              ))}
              {visiblePulseSensors.map((s) => (
                <Marker key={s.id} position={[s.lat, s.lng]} icon={pulseIcon}>
                  <Popup><p className='font-bold'>{sensorName(s, t)}</p><p className='text-xs'>{t('air.pulseSensor')}</p></Popup>
                </Marker>
              ))}
              {visibleCitySensors.map((s) => (
                <Marker key={s.id} position={[s.lat, s.lng]} icon={cityIcon}>
                  <Popup>
                    <p className='font-bold'>{sensorName(s, t)}</p>
                    <p className='text-xs'>{t('air.citySensor')}</p>
                    <p className='text-xs'>AQI: <b>{s.aqi}</b></p>
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
            <span className='flex items-center gap-1.5'><span className='h-2.5 w-2.5 rounded-full border-2 border-violet-400 bg-violet-200' />{t('air.legendCity')}</span>
            <span className='ml-auto'>{t('air.shownLabel')}: {visibleCount} / {allSensors.length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Smell report */}
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Flame className='h-4 w-4 text-rose-500' />{t('air.reportSmell')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitSmell} className='space-y-4'>
            {gps.loading ? (
              <div className='flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500'>
                <Loader2 className='h-4 w-4 animate-spin text-slate-400' />{t('gps.requesting')}
              </div>
            ) : gps.error ? (
              <div className='space-y-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3'>
                <div className='flex items-start gap-2 text-sm text-rose-700'><XCircle className='mt-0.5 h-4 w-4 shrink-0' /><span>{gps.error}</span></div>
                <button type='button' onClick={requestGPS} className='flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50'>
                  <MapPin className='h-4 w-4' />{t('gps.retry2')}
                </button>
              </div>
            ) : (
              <div className='flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700'>
                <CheckCircle2 className='h-4 w-4 shrink-0' /><span className='font-medium'>{t('gps.captured')}</span>
                <span className='ml-auto text-xs opacity-70'>{gps.label}</span>
              </div>
            )}
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>{t('form.smellIntensity')}</p>
              <div className='flex gap-2'>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type='button' onClick={() => setIntensity(n)}
                    className='flex flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all duration-150'
                    style={{ borderColor: intensity >= n ? '#f97316' : '#e2e8f0', background: intensity >= n ? '#fff7ed' : '#f8fafc', color: intensity >= n ? '#ea580c' : '#94a3b8' }}>
                    <Flame className='h-5 w-5' style={{ fill: intensity >= n ? '#fb923c' : 'none', color: intensity >= n ? '#ea580c' : '#cbd5e1' }} />
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Textarea value={smellDesc} onChange={(e) => setSmellDesc(e.target.value)} placeholder={t('form.smellPlaceholder')} className='min-h-20' />
            <Button type='submit' className='w-full' disabled={gps.loading}>{t('common.submitReport')}</Button>
          </form>
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

      <Toast toast={toast} onClose={() => setToast('')} />
      <SubmitSuccessModal open={submitted} onClose={() => setSubmitted(false)} />
    </div>
  )
}
