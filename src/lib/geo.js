import { skopjeRecyclingContainers, skopjeWasteBaskets } from '../data/skopjeContainersMap'

// Растојание меѓу две GPS точки во метри (Haversine формула).
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

// Ги обединува сите познати OSM точки (контејнери за рециклажа + јавни корпи).
const ALL_POINTS = [...skopjeRecyclingContainers, ...skopjeWasteBaskets]

// Наоѓа најблиска позната точка до дадени координати.
// `maxMeters` — ако најблиската е подалеку, враќа null (пријавата е на непознат
// контејнер, па не врзуваме погрешно).
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
