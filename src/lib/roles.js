// Улоги во Еко Скопје — заедничка логика за навигација и UI дозволи.

export const ROLES = {
  USER: 'user',
  ORGANIZATION: 'organization',
  SUPER_ADMIN: 'admin',
  ADMIN_INSPECTION: 'admin_inspection', // Комунална Инспекција → диви депонии
  ADMIN_ENVIRONMENT: 'admin_environment', // Животна Средина → воздух / миризби
  ADMIN_HYGIENE: 'admin_hygiene', // Комунална Хигиена → контејнери
}

export const ADMIN_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN_INSPECTION,
  ROLES.ADMIN_ENVIRONMENT,
  ROLES.ADMIN_HYGIENE,
]

/** Сите администраторски улоги (вкл. супер админ). */
export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role)
}

/** Само супер админ — целосен пристап. */
export function isSuperAdmin(role) {
  return role === ROLES.SUPER_ADMIN
}

/**
 * Дозволени типови пријави за улогата.
 * `null` = сите типови (супер админ).
 */
export function reportTypesForRole(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return null
    case ROLES.ADMIN_INSPECTION:
      return ['waste']
    case ROLES.ADMIN_ENVIRONMENT:
      return ['smell']
    case ROLES.ADMIN_HYGIENE:
      return ['container']
    default:
      return []
  }
}

export function canAccessReportType(role, type) {
  const allowed = reportTypesForRole(role)
  if (allowed === null) return true
  return allowed.includes(type)
}

export function canManageCommunityUsers(role) {
  return isSuperAdmin(role)
}

export function canApproveEvents(role) {
  return isSuperAdmin(role)
}

/** Почетна рута по најава според улога. */
export function postLoginPath(role) {
  if (isAdminRole(role)) return '/admin-desk'
  return '/home'
}

/** i18n клуч за приказ на улогата. */
export function roleLabelKey(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return 'role.admin'
    case ROLES.ADMIN_INSPECTION:
      return 'role.adminInspection'
    case ROLES.ADMIN_ENVIRONMENT:
      return 'role.adminEnvironment'
    case ROLES.ADMIN_HYGIENE:
      return 'role.adminHygiene'
    case ROLES.ORGANIZATION:
      return 'role.organization'
    default:
      return 'role.user'
  }
}

export function roleShortLabelKey(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return 'role.adminShort'
    case ROLES.ADMIN_INSPECTION:
      return 'role.adminInspectionShort'
    case ROLES.ADMIN_ENVIRONMENT:
      return 'role.adminEnvironmentShort'
    case ROLES.ADMIN_HYGIENE:
      return 'role.adminHygieneShort'
    case ROLES.ORGANIZATION:
      return 'role.organization'
    default:
      return 'role.user'
  }
}
