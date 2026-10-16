// Клиент за WAQI податоци — преку backend (/api/air/waqi), за да работат
// Capacitor Android/iOS без VITE_WAQI_TOKEN во билдот.
// Локален fallback: директен WAQI повикот ако има токен (веб dev).

import { Capacitor } from '@capacitor/core'

const WAQI_TOKEN = import.meta.env.VITE_WAQI_TOKEN
const API = 'https://api.waqi.info'
const SKOPJE_BOUNDS = '41.90,21.30,42.10,21.75'
const EXTRA_UIDS = [12408]
const FRESH_MS = 48 * 60 * 60 * 1000

const PRODUCTION_API = 'https://ekoskopje.skopje.gov.mk'

function isLocalhostUrl(url) {
  return /localhost|127\.0\.0\.1/.test(url)
}

function resolveApiUrl() {
  const fromEnv = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  if (Capacitor.isNativePlatform()) {
    if (fromEnv && !isLocalhostUrl(fromEnv)) return fromEnv
    return PRODUCTION_API
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'ekoskopje.skopje.gov.mk' || host.endsWith('.skopje.gov.mk')) return ''
    if (fromEnv && isLocalhostUrl(fromEnv) && host !== 'localhost' && host !== '127.0.0.1') return ''
  }
  if (fromEnv) return fromEnv
  if (import.meta.env.DEV) return 'http://localhost:4000'
  return ''
}

const NAME_MK = {
  centar: 'Центар',
  'gazi baba': 'Гази Баба',
  karposh: 'Карпош',
  karpos: 'Карпош',
  lisice: 'Лисиче',
  rektorat: 'Ректорат',
  miladinovci: 'Миладиновци',
  'gjorche petrov': 'Ѓорче Петров',
  mobilegp: 'Мобилна станица — Ѓорче Петров',
}

const NAME_KEY = {
  centar: 'centar',
  'gazi baba': 'gaziBaba',
  karposh: 'karpos',
  karpos: 'karpos',
  lisice: 'lisice',
  rektorat: 'rektorat',
  miladinovci: 'miladinovci',
  'gjorche petrov': 'gjorchePetrov',
  'nova international school skopje': 'nova',
  mobilegp: 'mobileGP',
}

const REFERENT_KEYS = new Set(Object.keys(NAME_MK))

function nameKeyFor(raw) {
  const key = String(raw || '').split(',')[0].trim().toLowerCase()
  return NAME_KEY[key] || null
}

function categoryFor(rawName, uid) {
  if (Number(uid) < 0) return 'nonreferent'
  const key = String(rawName || '').split(',')[0].trim().toLowerCase()
  return REFERENT_KEYS.has(key) ? 'referent' : 'nonreferent'
}

function statusFromAqi(aqi) {
  if (aqi >= 101) return 'unhealthy'
  if (aqi >= 51) return 'moderate'
  return 'good'
}

function cleanName(raw) {
  const base = String(raw || '').split(',')[0].trim()
  const key = base.toLowerCase()
  return NAME_MK[key] || base || 'Непозната станица'
}

function toNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function getJson(url, signal) {
  const res = await fetch(url, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`WAQI HTTP ${res.status}`)
  const json = await res.json()
  if (json.status !== 'ok') throw new Error('WAQI status not ok')
  return json.data
}

async function fetchStationDetail(uid, signal) {
  try {
    const d = await getJson(`${API}/feed/@${uid}/?token=${WAQI_TOKEN}`, signal)
    return {
      pm25: toNumber(d.iaqi?.pm25?.v),
      pm10: toNumber(d.iaqi?.pm10?.v),
      aqi: toNumber(d.aqi),
      updatedAt: d.time?.iso || null,
      name: d.city?.name || null,
      lat: toNumber(d.city?.geo?.[0]),
      lng: toNumber(d.city?.geo?.[1]),
    }
  } catch {
    return null
  }
}

function isFresh(iso) {
  if (!iso) return false
  const t = Date.parse(iso)
  return Number.isFinite(t) && Date.now() - t < FRESH_MS
}

async function fetchSkopjeSensorsDirect(signal) {
  if (!WAQI_TOKEN) throw new Error('VITE_WAQI_TOKEN не е поставен')
  const list = await getJson(
    `${API}/map/bounds/?token=${WAQI_TOKEN}&latlng=${SKOPJE_BOUNDS}&networks=all`,
    signal,
  )

  const stations = (Array.isArray(list) ? list : []).filter((s) => toNumber(s.uid) != null)
  const boundsUids = new Set(stations.map((s) => Number(s.uid)))
  const extraUids = EXTRA_UIDS.filter((uid) => !boundsUids.has(uid))

  const [details, extraDetails] = await Promise.all([
    Promise.all(stations.map((s) => fetchStationDetail(s.uid, signal))),
    Promise.all(extraUids.map((uid) => fetchStationDetail(uid, signal))),
  ])

  const fromBounds = stations.map((s, i) => {
    const detail = details[i] || {}
    const aqi = detail.aqi ?? toNumber(s.aqi) ?? 0
    const name = cleanName(s.station?.name)
    const category = categoryFor(s.station?.name, s.uid)
    const referent = category === 'referent'
    return {
      id: `WAQI-${s.uid}`,
      name,
      nameKey: nameKeyFor(s.station?.name),
      area: name,
      aqi,
      pm25: detail.pm25 ?? null,
      pm10: detail.pm10 ?? null,
      status: statusFromAqi(aqi),
      lat: toNumber(s.lat),
      lng: toNumber(s.lon),
      category,
      source: referent ? 'МЖСПП (WAQI)' : 'Граѓански сензор (WAQI)',
      updatedAt: detail.updatedAt || null,
      sourceUrl: referent ? 'https://air.moepp.gov.mk/' : 'https://aqicn.org/',
    }
  })

  const fromExtras = extraUids.map((uid, i) => {
    const d = extraDetails[i]
    if (!d || d.aqi == null || d.lat == null || d.lng == null || !isFresh(d.updatedAt)) return null
    const name = cleanName(d.name)
    const category = categoryFor(d.name, uid)
    const referent = category === 'referent'
    return {
      id: `WAQI-${uid}`,
      name,
      nameKey: nameKeyFor(d.name),
      area: name,
      aqi: d.aqi,
      pm25: d.pm25 ?? null,
      pm10: d.pm10 ?? null,
      status: statusFromAqi(d.aqi),
      lat: d.lat,
      lng: d.lng,
      category,
      source: referent ? 'МЖСПП (WAQI)' : 'Граѓански сензор (WAQI)',
      updatedAt: d.updatedAt || null,
      sourceUrl: referent ? 'https://air.moepp.gov.mk/' : 'https://aqicn.org/',
    }
  }).filter(Boolean)

  return [...fromBounds, ...fromExtras]
}

async function fetchSkopjeSensorsViaBackend(_signal) {
  const base = resolveApiUrl()
  const res = await fetch(`${base}/api/air/waqi`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`WAQI proxy HTTP ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

/** Преферира backend (мобилни + прод); fallback директен WAQI ако има токен. */
export async function fetchSkopjeSensors(signal) {
  try {
    return await fetchSkopjeSensorsViaBackend(signal)
  } catch (err) {
    if (WAQI_TOKEN) return fetchSkopjeSensorsDirect(signal)
    throw err
  }
}
