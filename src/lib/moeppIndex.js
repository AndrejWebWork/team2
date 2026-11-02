// Часовен индекс на МЖСПП за PM2.5 и PM10.
// https://air.moepp.gov.mk/StaticSites/air_quality_index
// Боите се истите од табелата на министерството.

export const MOEPP_LEVELS = [
  { key: 'good', bg: '#00FFFF', text: '#0f172a' },
  { key: 'fair', bg: '#66CDAA', text: '#0f172a' },
  { key: 'moderate', bg: '#FFD700', text: '#0f172a' },
  { key: 'poor', bg: '#FA8072', text: '#0f172a' },
  { key: 'veryPoor', bg: '#8B0000', text: '#ffffff' },
  { key: 'extreme', bg: '#800080', text: '#ffffff' },
]

// Горна граница на секое ниво, по редослед. Над последната е „екстремно лошо“.
const PM25_MAX = [5, 15, 50, 90, 140]
const PM10_MAX = [15, 45, 120, 195, 270]

const RANK = { good: 0, fair: 1, moderate: 2, poor: 3, veryPoor: 4, extreme: 5 }

export function pollutantLevel(kind, value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  const cuts = kind === 'pm10' ? PM10_MAX : PM25_MAX
  const idx = cuts.findIndex((max) => n <= max)
  return MOEPP_LEVELS[idx === -1 ? MOEPP_LEVELS.length - 1 : idx]
}

export function worsePmLevel(pm25, pm10) {
  const levels = [pollutantLevel('pm25', pm25), pollutantLevel('pm10', pm10)].filter(Boolean)
  if (!levels.length) return null
  return levels.reduce((worst, level) => (RANK[level.key] > RANK[worst.key] ? level : worst))
}

export const PM_RANGE_LABEL = {
  good: 'PM2.5 0–5 · PM10 0–15',
  fair: 'PM2.5 6–15 · PM10 16–45',
  moderate: 'PM2.5 16–50 · PM10 46–120',
  poor: 'PM2.5 51–90 · PM10 121–195',
  veryPoor: 'PM2.5 91–140 · PM10 196–270',
  extreme: 'PM2.5 >140 · PM10 >270',
}
