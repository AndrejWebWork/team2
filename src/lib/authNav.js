const AUTH_ROUTES = new Set(['/login', '/forgot-password', '/reset-password', '/auth-loading'])

export function resolveAuthReturnTo(path, fallback = '/home') {
  return path && !AUTH_ROUTES.has(path) ? path : fallback
}

export function loginNavState(returnTo, fallback = '/home') {
  return { allowLogin: true, returnTo: resolveAuthReturnTo(returnTo, fallback) }
}
