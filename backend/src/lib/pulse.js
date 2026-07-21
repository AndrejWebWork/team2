// ============================================================================
// Pulse.eco — граѓанска (НЕРЕФЕРЕНТНА) мрежа сензори за Скопје, во живо.
// WAQI ги дава само 6-те официјални МЖСПП станици; граѓанските нискобуџетни
// сензори доаѓаат оттука. Го прокси-раме преку backend (CORS + кеш за скала).
// Јавно API, без токен: /rest/current (мерења) и /rest/sensor (имиња/позиции).
// ============================================================================

const BASE = 'https://skopje.pulse.eco/rest'
const HEADERS = { 'User-Agent': 'EkoSkopje/1.0 (Grad Skopje)' }

// Граници на Скопскиот регион — Pulse.eco повремено враќа сензори со сосема
// погрешни координати (пр. уред регистриран во странство), па ги отфрламе.
const BOUNDS = { latMin: 41.85, latMax: 42.15, lngMin: 21.25, lngMax: 21.80 }

function inSkopje(lat, lng) {
  return lat >= BOUNDS.latMin && lat <= BOUNDS.latMax && lng >= BOUNDS.lngMin && lng <= BOUNDS.lngMax
}

// US EPA AQI од PM2.5 (µg/m³) — стандардна конверзија со линеарна интерполација.
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

function parsePosition(pos) {
  const [lat, lng] = String(pos || '').split(',').map((x) => num(x))
  return { lat: lat ?? null, lng: lng ?? null }
}

async function getJson(url, signal) {
  const res = await fetch(url, { headers: HEADERS, signal })
  if (!res.ok) throw new Error(`Pulse.eco HTTP ${res.status}`)
  return res.json()
}

// Имиња/позиции на сензорите ретко се менуваат → кеш 1 час.
const META_TTL_MS = 60 * 60 * 1000
let metaCache = { map: new Map(), at: 0 }

async function getSensorMeta(signal) {
  if (Date.now() - metaCache.at < META_TTL_MS && metaCache.map.size) {
    return metaCache.map
  }
  const sensors = await getJson(`${BASE}/sensor`, signal).catch(() => null)
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

// Ги враќа сите граѓански сензори што имаат мерење за PM2.5 или PM10, во истиот
// облик како референтните (WAQI) сензори за директно спојување во клиентот.
export async function fetchPulseSensors(signal) {
  // Само мерењата се влечат секогаш (свежи); имињата се од долгиот кеш.
  const [current, metaById] = await Promise.all([
    getJson(`${BASE}/current`, signal),
    getSensorMeta(signal),
  ])

  // Групирај мерења по сензор; чувај ги последните вредности по тип.
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
    // Прикажуваме само сензори со реален PM податок (тоа е поентата на воздух).
    if (pm25 == null && pm10 == null) continue
    const meta = metaById.get(entry.sensorId)
    const { lat, lng } = parsePosition(entry.position || meta?.position)
    if (lat == null || lng == null || !inSkopje(lat, lng)) continue
    const aqi = aqiFromPm25(pm25) ?? (pm10 != null ? aqiFromPm25(pm10 * 0.6) : 0)
    const rawName = meta?.name
    const name = (rawName && rawName.trim()) || `Граѓански сензор ${String(entry.sensorId).slice(0, 6)}`
    // Официјалните МЖСПП станици веќе доаѓаат како референтни преку WAQI —
    // прескокни ги нивните копии во Pulse.eco за да нема дупли маркери.
    if (/^moepp/i.test(name)) continue
    out.push({
      id: `PULSE-${entry.sensorId}`,
      name,
      area: name,
      aqi,
      pm25,
      pm10,
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
