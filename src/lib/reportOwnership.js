// Идентитет за „мои пријави" — како кај известувањата (email или уред за анонимен).
export function reportsIdentity(auth, deviceId) {
  if (auth?.email && !auth?.isAnonymous) return auth.email
  return deviceId
}

export function reportsCacheKey(auth, deviceId) {
  return `ekoskopje.reports.cache.${reportsIdentity(auth, deviceId)}`
}

function isRegisteredReporterId(id) {
  if (!id || typeof id !== 'string') return false
  if (id.startsWith('local-') || id.startsWith('C-local-')) return false
  return /^[0-9a-f-]{36}$/i.test(id)
}

/** Дали пријавата припаѓа на моменталниот корисник (не на претходна сесија). */
export function isMyReport(report, auth, deviceId) {
  const loggedIn = Boolean(auth?.email && !auth?.isAnonymous)

  if (loggedIn) {
    if (report.reportedBy === auth.email) return true
    if (auth.userId && report.reportedById === auth.userId) return true
    if (report.reportedById === auth.email) return true
    return false
  }

  // Анонимен: само пријави без регистриран reporter_id на овој уред.
  if (isRegisteredReporterId(report.reportedById)) return false
  return report.reportedByDevice === deviceId || report.reportedById === deviceId
}
