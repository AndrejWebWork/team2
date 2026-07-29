import { skopjeRecyclingContainers, skopjeWasteBaskets } from '../data/skopjeContainersMap'

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse'
const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'mk',
  'User-Agent': 'Еко Скопје/1.0 (https://team2-zeta.vercel.app; civic environmental reporting)',
}

const SKOPJE_CITY_NAMES = new Set(['скопје', 'skopje', 'city of skopje'])

// Растојание меѓу две GPS точки во метри (Haversine — „воздушна линија").
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function haversineKm(a, b) {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return Infinity
  return haversineMeters(a.lat, a.lng, b.lat, b.lng) / 1000
}

const ALL_POINTS = [...skopjeRecyclingContainers, ...skopjeWasteBaskets]

function normalizeMunicipalityName(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/^Општина\s+/i, '').replace(/^Opština\s+/i, '').replace(/^Opstina\s+/i, '').trim()
}

function isSkopjeAddress(a) {
  const city = String(a.city || a.town || '').toLowerCase()
  const region = String(a.county || a.state || a.region || '').toLowerCase()
  return SKOPJE_CITY_NAMES.has(city) || region.includes('skopje') || region.includes('скопје')
}

function municipalityFromAddress(a) {
  // Во Град Скопје Nominatim најчесто ја враќа општината како city_district.
  if (isSkopjeAddress(a) && a.city_district) {
    return normalizeMunicipalityName(a.city_district)
  }
  for (const key of ['municipality', 'city_district', 'suburb', 'town', 'city', 'village']) {
    const name = normalizeMunicipalityName(a[key])
    if (name) return name
  }
  return ''
}

function labelFromAddress(a, lat, lng) {
  return (
    a.road ||
    a.suburb ||
    a.neighbourhood ||
    a.city_district ||
    a.city ||
    `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`
  )
}

function validCoords(lat, lng) {
  const numLat = Number(lat)
  const numLng = Number(lng)
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return null
  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) return null
  return { lat: numLat, lng: numLng }
}

async function reverseGeocodeNominatim(lat, lng) {
  const coords = validCoords(lat, lng)
  if (!coords) return null

  const url = new URL(NOMINATIM)
  url.searchParams.set('lat', coords.lat.toFixed(6))
  url.searchParams.set('lon', coords.lng.toFixed(6))
  url.searchParams.set('format', 'json')
  url.searchParams.set('zoom', '16')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: NOMINATIM_HEADERS,
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) return null
  const data = await res.json()
  const a = data.address || {}
  return {
    label: labelFromAddress(a, coords.lat, coords.lng),
    municipality: municipalityFromAddress(a),
  }
}

/** Адресна етикета за приказ (улица/населба). */
export async function resolveLocationLabel(lat, lng) {
  try {
    const info = await reverseGeocodeNominatim(lat, lng)
    if (info?.label) return info.label
  } catch { /* fall through */ }
  const coords = validCoords(lat, lng)
  return coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : ''
}

/** Општина за координати (Nominatim). */
export async function resolveMunicipality(lat, lng) {
  try {
    const info = await reverseGeocodeNominatim(lat, lng)
    return info?.municipality || ''
  } catch {
    return ''
  }
}

/** Едно Nominatim барање → етикета + општина (конзистентно). */
export async function resolveLocationInfo(lat, lng) {
  try {
    const info = await reverseGeocodeNominatim(lat, lng)
    if (info) return info
  } catch { /* fall through */ }
  const coords = validCoords(lat, lng)
  const fallback = coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : ''
  return { label: fallback, municipality: '' }
}

/** Најблиска позната OSM точка (контејнер/корпа) по воздушна линија. */
export function findNearestContainerPoint(lat, lng, maxMeters = 150) {
  if (lat == null || lng == null || !ALL_POINTS.length) return null
  let best = null
  for (const p of ALL_POINTS) {
    const d = haversineMeters(lat, lng, p.lat, p.lng)
    if (!best || d < best.distanceM) best = { id: p.id, type: p.type, distanceM: d }
  }
  if (!best || best.distanceM > maxMeters) return null
  return { id: best.id, type: best.type, distanceM: Math.round(best.distanceM) }
}

/** Најблизок сензор од листа (без максимална дистанца — за приказ на AirPage). */
export function findNearestAirSensor(lat, lng, sensors) {
  if (lat == null || lng == null || !sensors?.length) return null
  let best = null
  let bestDist = Infinity
  for (const s of sensors) {
    if (s?.lat == null || s?.lng == null) continue
    const d = haversineMeters(lat, lng, s.lat, s.lng)
    if (d < bestDist) {
      bestDist = d
      best = s
    }
  }
  if (!best) return null
  return { sensor: best, distanceM: Math.round(bestDist) }
}
