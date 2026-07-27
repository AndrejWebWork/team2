import https from 'node:https'
import { URL } from 'node:url'

// ============================================================================
// Нереферентни (граѓански) сензори за Скопје.
// 1) Pulse.eco — примарно (кога API работи)
// 2) Sensor.community — fallback кога Pulse е празен/паднат
// Endpoint-от останува /api/air/pulse — клиентот не се менува.
// ============================================================================

const PULSE_BASE = 'https://skopje.pulse.eco/rest'
const PULSE_HEADERS = { 'User-Agent': 'EkoSkopje/1.0 (Grad Skopje)', Accept: 'application/json' }
// skopje.pulse.eco често има проблем со TLS сертификат.
const pulseAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true })

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

/** SDS011/граѓански често враќаат ~0 при грешка — тоа дава AQI 0/1 и изгледа скршено. */
function hasUsablePm(pm25, pm10) {
  return (pm25 != null && pm25 >= 1) || (pm10 != null && pm10 >= 1)
}

function aqiFromPm(pm25, pm10) {
  if (pm25 != null && pm25 >= 1) return aqiFromPm25(pm25)
  if (pm10 != null && pm10 >= 1) return aqiFromPm25(pm10 * 0.6)
  return null
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

function parsePosition(pos) {
  const [lat, lng] = String(pos || '').split(',').map((x) => num(x))
  return { lat: lat ?? null, lng: lng ?? null }
}

function getPulseJson(url, signal) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const req = https.get(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path: `${u.pathname}${u.search}`,
        headers: PULSE_HEADERS,
        agent: pulseAgent,
        timeout: 20_000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume()
          reject(new Error(`Pulse.eco HTTP ${res.statusCode}`))
          return
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (err) {
            reject(err)
          }
        })
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Pulse.eco timeout'))
    })
    if (signal) {
      if (signal.aborted) {
        req.destroy()
        reject(new Error('aborted'))
        return
      }
      signal.addEventListener('abort', () => {
        req.destroy()
        reject(new Error('aborted'))
      }, { once: true })
    }
  })
}

const META_TTL_MS = 60 * 60 * 1000
let metaCache = { map: new Map(), at: 0 }

async function getSensorMeta(signal) {
  if (Date.now() - metaCache.at < META_TTL_MS && metaCache.map.size) {
    return metaCache.map
  }
  const sensors = await getPulseJson(`${PULSE_BASE}/sensor`, signal).catch(() => null)
  if (!Array.isArray(sensors)) return metaCache.map
  const map = new Map()
  for (const s of sensors) {
    if (!s?.sensorId) continue
    map.set(s.sensorId, {
      name: s.description || s.comments || null,
      position: s.position || null,
    })
  }
  metaCache = { map, at: Date.now() }
  return map
}

async function fetchFromPulseEco(signal) {
  const [current, metaById] = await Promise.all([
    getPulseJson(`${PULSE_BASE}/current`, signal),
    getSensorMeta(signal),
  ])

  const byId = new Map()
  for (const r of Array.isArray(current) ? current : []) {
    if (!r?.sensorId) continue
    let entry = byId.get(r.sensorId)
    if (!entry) {
      entry = { sensorId: r.sensorId, position: r.position, stamp: r.stamp, values: {} }
      byId.set(r.sensorId, entry)
    }
    entry.values[r.type] = r.value
    if (r.stamp > entry.stamp) entry.stamp = r.stamp
    if (!entry.position && r.position) entry.position = r.position
  }

  const out = []
  for (const entry of byId.values()) {
    const pm25 = num(entry.values.pm25)
    const pm10 = num(entry.values.pm10)
    if (!hasUsablePm(pm25, pm10)) continue
    const meta = metaById.get(entry.sensorId)
    const { lat, lng } = parsePosition(entry.position || meta?.position)
    if (lat == null || lng == null || !inSkopje(lat, lng)) continue
    const aqi = aqiFromPm(pm25, pm10) ?? 0
    const rawName = meta?.name
    const name = (rawName && rawName.trim()) || `Граѓански сензор ${String(entry.sensorId).slice(0, 6)}`
    if (/^moepp/i.test(name)) continue
    out.push({
      id: `PULSE-${entry.sensorId}`,
      name,
      area: name,
      aqi: Math.max(1, aqi),
      pm25: pm25 != null && pm25 >= 1 ? pm25 : null,
      pm10: pm10 != null && pm10 >= 1 ? pm10 : null,
      status: statusFromAqi(aqi),
      lat,
      lng,
      category: 'nonreferent',
      source: 'Pulse.eco (граѓански)',
      updatedAt: entry.stamp || null,
      sourceUrl: 'https://skopje.pulse.eco/',
    })
  }
  return out
}

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
    if (!hasUsablePm(pm25, pm10)) continue
    if (entry.lat == null || entry.lng == null || !inSkopje(entry.lat, entry.lng)) continue
    candidates.push({
      ...entry,
      pm25: pm25 != null && pm25 >= 1 ? pm25 : null,
      pm10: pm10 != null && pm10 >= 1 ? pm10 : null,
      areaName: nearestAreaName(entry.lat, entry.lng),
    })
  }

  const areaCounts = new Map()
  for (const c of candidates) areaCounts.set(c.areaName, (areaCounts.get(c.areaName) || 0) + 1)
  const areaIndex = new Map()

  const out = []
  for (const entry of candidates) {
    const aqi = aqiFromPm(entry.pm25, entry.pm10)
    if (aqi == null) continue
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
      aqi: Math.max(1, aqi),
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
    out = await fetchFromPulseEco(signal)
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
