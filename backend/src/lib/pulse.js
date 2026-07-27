// ============================================================================
// Нереферентни (граѓански) сензори за Скопје.
// Примарно: OpenAQ v3 (слободен API клуч: OPENAQ_API_KEY).
// Fallback: Sensor.community (без клуч) кога OpenAQ нема клуч / враќа празно / паѓа.
// Endpoint-от останува /api/air/pulse — клиентот не се менува.
// ============================================================================

const OPENAQ_BASE = 'https://api.openaq.org/v3'
const SKOPJE = { lat: 41.9981, lng: 21.4254 }
const RADIUS_M = 25_000
const BOUNDS = { latMin: 41.85, latMax: 42.15, lngMin: 21.25, lngMax: 21.80 }
const SC_AREA = 'https://data.sensor.community/airrohr/v1/filter/area=41.9981,21.4254,18'
const UA = 'EkoSkopje/1.0 (Grad Skopje)'

// Sensor.community не дава имиња — само координати. Името = најблиска населба/општина.
const SKOPJE_AREAS = [
  { name: 'Центар', lat: 41.9955, lng: 21.4315 },
  { name: 'Карпош', lat: 42.0065, lng: 21.3880 },
  { name: 'Влае', lat: 42.0040, lng: 21.3700 },
  { name: 'Тафталиџе', lat: 42.0010, lng: 21.3920 },
  { name: 'Гази Баба', lat: 42.0040, lng: 21.4640 },
  { name: 'Автокоманда', lat: 42.0085, lng: 21.4520 },
  { name: 'Маџари', lat: 42.0150, lng: 21.4900 },
  { name: 'Аеродром', lat: 41.9830, lng: 21.4620 },
  { name: 'Лисиче', lat: 41.9780, lng: 21.4700 },
  { name: 'Кисела Вода', lat: 41.9780, lng: 21.4450 },
  { name: 'Пржино', lat: 41.9680, lng: 21.4300 },
  { name: 'Бутел', lat: 42.0300, lng: 21.4450 },
  { name: 'Чаир', lat: 42.0160, lng: 21.4400 },
  { name: 'Топанско Поле', lat: 42.0220, lng: 21.4280 },
  { name: 'Ѓорче Петров', lat: 42.0070, lng: 21.3450 },
  { name: 'Хром', lat: 42.0000, lng: 21.3550 },
  { name: 'Сарај', lat: 41.9950, lng: 21.3000 },
  { name: 'Шуто Оризари', lat: 42.0380, lng: 21.4250 },
  { name: 'Радишани', lat: 42.0500, lng: 21.4500 },
  { name: 'Драчево', lat: 41.9400, lng: 21.5200 },
]

function inSkopje(lat, lng) {
  return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lng >= BOUNDS.lngMin && lng <= BOUNDS.lngMax
}

function dist2(aLat, aLng, bLat, bLng) {
  const dLat = aLat - bLat
  const dLng = aLng - bLng
  return dLat * dLat + dLng * dLng
}

function nearestAreaName(lat, lng) {
  let best = null
  let bestD = Infinity
  for (const a of SKOPJE_AREAS) {
    const d = dist2(lat, lng, a.lat, a.lng)
    if (d < bestD) {
      bestD = d
      best = a.name
    }
  }
  return best || 'Скопје'
}

const PM25_BREAKPOINTS = [
  [0.0, 12.0, 0, 50],
  [12.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 150.4, 151, 200],
  [150.5, 250.4, 201, 300],
  [250.5, 350.4, 301, 400],
  [350.5, 500.4, 401, 500],
]

function aqiFromPm25(pm) {
  if (pm == null || !Number.isFinite(pm)) return null
  const c = Math.max(0, pm)
  for (const [cLo, cHi, aLo, aHi] of PM25_BREAKPOINTS) {
    if (c <= cHi) return Math.round(((aHi - aLo) / (cHi - cLo)) * (c - cLo) + aLo)
  }
  return 500
}

function statusFromAqi(aqi) {
  if (aqi == null) return null
  if (aqi >= 101) return 'unhealthy'
  if (aqi >= 51) return 'moderate'
  return 'good'
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function openaqKey() {
  return (process.env.OPENAQ_API_KEY || '').trim()
}

function paramKind(name) {
  const n = String(name || '').toLowerCase().replace(/[\s._-]/g, '')
  if (n === 'pm25' || n === 'pm25µg/m³' || n === 'pm2.5') return 'pm25'
  if (n === 'pm10' || n === 'pm10µg/m³') return 'pm10'
  return null
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return out
}

async function fetchFromOpenAQ(signal) {
  const key = openaqKey()
  if (!key) throw new Error('OPENAQ_API_KEY missing')

  const headers = {
    Accept: 'application/json',
    'User-Agent': UA,
    'X-API-Key': key,
  }

  // Нереферентни: monitor=false (референтните МЖСПП се преку WAQI).
  const locUrl =
    `${OPENAQ_BASE}/locations` +
    `?coordinates=${SKOPJE.lat},${SKOPJE.lng}` +
    `&radius=${RADIUS_M}&limit=100&monitor=false`

  const locRes = await fetch(locUrl, { headers, signal })
  if (!locRes.ok) throw new Error(`OpenAQ locations HTTP ${locRes.status}`)
  const locData = await locRes.json()
  const locations = Array.isArray(locData?.results) ? locData.results : []
  if (!locations.length) return []

  // Само локации со PM сензор и свежи податоци (последни ~36ч).
  const minIso = new Date(Date.now() - 36 * 3600 * 1000).toISOString()
  const withPm = locations.filter((loc) => {
    const sensors = Array.isArray(loc?.sensors) ? loc.sensors : []
    return sensors.some((s) => paramKind(s?.parameter?.name || s?.name))
  })

  const rows = await mapPool(withPm.slice(0, 60), 6, async (loc) => {
    try {
      const url = `${OPENAQ_BASE}/locations/${loc.id}/latest?limit=100&datetime_min=${encodeURIComponent(minIso)}`
      const res = await fetch(url, { headers, signal })
      if (!res.ok) return null
      const data = await res.json()
      const latest = Array.isArray(data?.results) ? data.results : []
      if (!latest.length) return null

      const sensorById = new Map()
      for (const s of loc.sensors || []) {
        if (s?.id != null) sensorById.set(s.id, s)
      }

      let pm25 = null
      let pm10 = null
      let stamp = null
      for (const row of latest) {
        const sensor = sensorById.get(row.sensorsId)
        const kind = paramKind(sensor?.parameter?.name || sensor?.name)
        const val = num(row.value)
        if (val == null || !kind) continue
        if (kind === 'pm25') pm25 = val
        if (kind === 'pm10') pm10 = val
        const t = row.datetime?.utc || row.datetime?.local
        if (t && (!stamp || t > stamp)) stamp = t
      }
      if (pm25 == null && pm10 == null) return null

      const lat = num(loc.coordinates?.latitude)
      const lng = num(loc.coordinates?.longitude)
      if (lat == null || lng == null || !inSkopje(lat, lng)) return null

      const aqi = aqiFromPm25(pm25) ?? (pm10 != null ? aqiFromPm25(pm10 * 0.6) : 0)
      const rawName = (loc.name || loc.locality || '').trim()
      if (/^moepp/i.test(rawName)) return null
      const name = rawName || `OpenAQ ${loc.id}`
      const provider = loc.provider?.name ? String(loc.provider.name) : 'OpenAQ'

      return {
        id: `PULSE-OA-${loc.id}`,
        name,
        area: name,
        aqi,
        pm25,
        pm10,
        status: statusFromAqi(aqi),
        lat,
        lng,
        category: 'nonreferent',
        source: `OpenAQ (${provider})`,
        updatedAt: stamp || loc.datetimeLast?.utc || null,
        sourceUrl: 'https://openaq.org/',
      }
    } catch {
      return null
    }
  })

  return rows.filter(Boolean)
}

/** Fallback кога OpenAQ нема клуч / е празен / паднат. */
async function fetchFromSensorCommunity(signal) {
  const res = await fetch(SC_AREA, {
    signal,
    headers: { Accept: 'application/json', 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`Sensor.community HTTP ${res.status}`)
  const rows = await res.json()
  if (!Array.isArray(rows)) return []

  const byId = new Map()
  for (const row of rows) {
    const id = row?.sensor?.id
    if (id == null) continue
    if (Number(row?.location?.indoor) === 1) continue
    let entry = byId.get(id)
    if (!entry) {
      entry = { id, lat: null, lng: null, values: {}, stamp: null }
      byId.set(id, entry)
    }
    entry.lat = num(row.location?.latitude)
    entry.lng = num(row.location?.longitude)
    if (row.timestamp) entry.stamp = String(row.timestamp).replace(' ', 'T') + 'Z'
    for (const v of row.sensordatavalues || []) {
      const key = String(v.value_type || '')
      const val = num(v.value)
      if (val == null) continue
      if (key === 'P2' || key === 'SDS_P2') entry.values.pm25 = val
      if (key === 'P1' || key === 'SDS_P1') entry.values.pm10 = val
    }
  }

  const candidates = []
  for (const entry of byId.values()) {
    const pm25 = entry.values.pm25 ?? null
    const pm10 = entry.values.pm10 ?? null
    if (pm25 == null && pm10 == null) continue
    if (entry.lat == null || entry.lng == null || !inSkopje(entry.lat, entry.lng)) continue
    candidates.push({
      ...entry,
      pm25,
      pm10,
      areaName: nearestAreaName(entry.lat, entry.lng),
    })
  }

  // Ако повеќе сензори се во иста населба → „Карпош 1“, „Карпош 2“…
  const areaCounts = new Map()
  for (const c of candidates) areaCounts.set(c.areaName, (areaCounts.get(c.areaName) || 0) + 1)
  const areaIndex = new Map()

  const out = []
  for (const entry of candidates) {
    const aqi = aqiFromPm25(entry.pm25) ?? (entry.pm10 != null ? aqiFromPm25(entry.pm10 * 0.6) : 0)
    let name = entry.areaName
    if ((areaCounts.get(entry.areaName) || 0) > 1) {
      const n = (areaIndex.get(entry.areaName) || 0) + 1
      areaIndex.set(entry.areaName, n)
      name = `${entry.areaName} ${n}`
    }
    out.push({
      id: `PULSE-SC-${entry.id}`,
      name,
      area: entry.areaName,
      aqi,
      pm25: entry.pm25,
      pm10: entry.pm10,
      status: statusFromAqi(aqi),
      lat: entry.lat,
      lng: entry.lng,
      category: 'nonreferent',
      source: 'Sensor.community',
      updatedAt: entry.stamp || null,
      sourceUrl: 'https://sensor.community/',
    })
  }
  return out
}

export async function fetchPulseSensors(signal) {
  let out = []
  try {
    out = await fetchFromOpenAQ(signal)
  } catch {
    out = []
  }
  if (!out.length) {
    try {
      out = await fetchFromSensorCommunity(signal)
    } catch {
      out = []
    }
  }
  return out
}
