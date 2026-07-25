// WAQI (aqicn.org) — официјални МЖСПП + граѓански станици за Скопје.
// Токенот живее само на серверот (WAQI_TOKEN), за да работат Capacitor
// Android/iOS билдови без VITE_WAQI_TOKEN во клиентот.

const API = 'https://api.waqi.info'
const SKOPJE_BOUNDS = '41.90,21.30,42.10,21.75'
const EXTRA_UIDS = [12408]
const FRESH_MS = 48 * 60 * 60 * 1000

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

function toNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

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

function isFresh(iso) {
  if (!iso) return false
  const t = Date.parse(iso)
  return Number.isFinite(t) && Date.now() - t < FRESH_MS
}

function getToken() {
  return (process.env.WAQI_TOKEN || process.env.VITE_WAQI_TOKEN || '').trim()
}

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`WAQI HTTP ${res.status}`)
  const json = await res.json()
  if (json.status !== 'ok') throw new Error('WAQI status not ok')
  return json.data
}

async function fetchStationDetail(uid, token) {
  try {
    const d = await getJson(`${API}/feed/@${uid}/?token=${token}`)
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

/** Сите WAQI станици во Скопје (референтни + граѓански). */
export async function fetchSkopjeWaqiSensors() {
  const token = getToken()
  if (!token) throw new Error('WAQI_TOKEN не е поставен на серверот')

  const list = await getJson(
    `${API}/map/bounds/?token=${token}&latlng=${SKOPJE_BOUNDS}&networks=all`,
  )
  const stations = (Array.isArray(list) ? list : []).filter((s) => toNumber(s.uid) != null)
  const boundsUids = new Set(stations.map((s) => Number(s.uid)))
  const extraUids = EXTRA_UIDS.filter((uid) => !boundsUids.has(uid))

  const [details, extraDetails] = await Promise.all([
    Promise.all(stations.map((s) => fetchStationDetail(s.uid, token))),
    Promise.all(extraUids.map((uid) => fetchStationDetail(uid, token))),
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
