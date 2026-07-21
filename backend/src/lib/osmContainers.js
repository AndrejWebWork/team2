import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = path.dirname(fileURLToPath(import.meta.url))
let FALLBACK_POINTS = []
try {
  FALLBACK_POINTS = JSON.parse(
    readFileSync(path.join(__dir, '../data/containerPoints.json'), 'utf8'),
  )
} catch {
  FALLBACK_POINTS = []
}
// ============================================================================
// OpenStreetMap (Overpass) — јавни точки за отпад во Скопје, во живо.
// Три категории: контејнери за рециклирање (amenity=recycling), јавни корпи
// (amenity=waste_basket) и контејнери за отпад (amenity=waste_disposal).
// При пад на Overpass се користи локална снимка (containerPoints.json).
// ============================================================================

// Граници на Скопскиот регион (југозапад -> североисток).
const BBOX = '41.85,21.25,42.15,21.80'

const QUERY = `[out:json][timeout:50];
(
  node["amenity"="recycling"](${BBOX});
  node["amenity"="waste_basket"](${BBOX});
  node["amenity"="waste_disposal"](${BBOX});
);
out;`

// Главна инстанца + огледало (fallback ако главната е зафатена/недостапна).
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  // Overpass бара идентификација на апликацијата (без UA враќа 406).
  'User-Agent': 'EkoSkopje/1.0 (Grad Skopje)',
}

const TYPE_BY_AMENITY = {
  recycling: 'recycling_container',
  waste_basket: 'waste_basket',
  waste_disposal: 'waste_disposal',
}

const PREFIX_BY_AMENITY = {
  recycling: 'REC',
  waste_basket: 'WB',
  waste_disposal: 'WD',
}

// Ги влече сите точки од Overpass (со fallback меѓу инстанците).
export async function fetchOsmContainers(signal) {
  let lastErr = null
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: HEADERS,
        body: 'data=' + encodeURIComponent(QUERY),
        signal,
      })
      if (!res.ok) { lastErr = new Error(`Overpass HTTP ${res.status}`); continue }
      const json = await res.json()
      const out = []
      for (const el of Array.isArray(json.elements) ? json.elements : []) {
        const amenity = el.tags?.amenity
        const type = TYPE_BY_AMENITY[amenity]
        if (!type || el.lat == null || el.lon == null) continue
        out.push({
          id: `${PREFIX_BY_AMENITY[amenity]}-${el.id}`,
          lat: el.lat,
          lng: el.lon,
          type,
          source: 'OpenStreetMap',
        })
      }
      if (out.length > 0) return out
      lastErr = new Error('Overpass врати празен резултат')
    } catch (err) {
      lastErr = err
    }
  }
  if (FALLBACK_POINTS.length > 0) return FALLBACK_POINTS
  throw lastErr || new Error('Overpass недостапен')
}
