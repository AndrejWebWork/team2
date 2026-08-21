// Иста логика како backend/src/lib/pointsPeriod.js — приказ на следниот reset.
export const POINTS_RESET_ISO = '2027-01-01'
export const POINTS_TZ = 'Europe/Skopje'

function nowInSkopje() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: POINTS_TZ }))
}

/** Следен 1 јануари кога се ресетираат поените и се доделуваат наградите. */
export function nextPointsResetIso() {
  const now = nowInSkopje()
  const first = new Date(`${POINTS_RESET_ISO}T00:00:00`)
  if (now < first) return POINTS_RESET_ISO
  return `${now.getFullYear() + 1}-01-01`
}

export function nextPointsResetLabel(lang) {
  const year = nextPointsResetIso().slice(0, 4)
  if (lang === 'en') return `1 January ${year}`
  if (lang === 'sq') return `1 janar ${year}`
  return `1 јануари ${year}`
}
