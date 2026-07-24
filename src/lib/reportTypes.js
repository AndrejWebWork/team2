export const REPORT_TYPES = ['smell', 'deponija', 'container']

export function isValidReportType(type) {
  return REPORT_TYPES.includes(type)
}

export function homeReportPath(type) {
  return isValidReportType(type) ? `/home?type=${type}#report` : '/home#report'
}
