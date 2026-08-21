// Период за лидерборд/поени:
//  — до 1 јануари 2027 (Europe/Skopje) се собираат сите поени (без месечен reset)
//  — на 1.1.2027 се ресетира, потоа секоја година на 1 јануари.
export const POINTS_RESET_LOCAL = '2027-01-01'
export const POINTS_TZ = 'Europe/Skopje'

/** SQL филтер врз alias `pe` (points_events). */
export const POINTS_PERIOD_SQL = `
  pe.created_at >= (
    CASE
      WHEN (now() AT TIME ZONE '${POINTS_TZ}') < TIMESTAMP '${POINTS_RESET_LOCAL}'
        THEN TIMESTAMPTZ '1970-01-01 00:00:00+00'
      ELSE (date_trunc('year', now() AT TIME ZONE '${POINTS_TZ}') AT TIME ZONE '${POINTS_TZ}')
    END
  )
  AND pe.created_at < (
    CASE
      WHEN (now() AT TIME ZONE '${POINTS_TZ}') < TIMESTAMP '${POINTS_RESET_LOCAL}'
        THEN (TIMESTAMP '${POINTS_RESET_LOCAL}' AT TIME ZONE '${POINTS_TZ}')
      ELSE ((date_trunc('year', now() AT TIME ZONE '${POINTS_TZ}') + INTERVAL '1 year') AT TIME ZONE '${POINTS_TZ}')
    END
  )
`

/** Клуч за leaderboard_awards.period_month (сезона до 2027, потоа година). */
export function currentAwardPeriodDate() {
  const nowSkopje = new Date(new Date().toLocaleString('en-US', { timeZone: POINTS_TZ }))
  const reset = new Date(`${POINTS_RESET_LOCAL}T00:00:00`)
  if (nowSkopje < reset) return '2026-01-01'
  const y = nowSkopje.getFullYear()
  return `${y}-01-01`
}
