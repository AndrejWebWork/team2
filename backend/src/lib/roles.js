// Улоги во Еко Скопје — серверска авторизација.

export const ROLES = {
  USER: 'user',
  ORGANIZATION: 'organization',
  SUPER_ADMIN: 'admin',
  ADMIN_INSPECTION: 'admin_inspection',
  ADMIN_ENVIRONMENT: 'admin_environment',
  ADMIN_HYGIENE: 'admin_hygiene',
}

export const ADMIN_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN_INSPECTION,
  ROLES.ADMIN_ENVIRONMENT,
  ROLES.ADMIN_HYGIENE,
]

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role)
}

export function isSuperAdmin(role) {
  return role === ROLES.SUPER_ADMIN
}

/** `null` = сите типови (супер админ). */
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

/** Сите админи добиваат push за секоја нова пријава (без разлика на тип). */
export function adminRolesForReportType(_type) {
  return [...ADMIN_ROLES]
}
