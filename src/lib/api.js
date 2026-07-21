// Клиент за EkoSkopje backend API-то (заедничко за веб + мобилни клиенти).
// Ако VITE_API_URL не е зададено: во dev → локален backend; во продукциски
// build (Vercel) → ист домен (релативни /api патеки).
import { hashPasswordForTransit } from './password'

const API_URL = (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:4000' : '')).replace(/\/$/, '')
// Админ токен за заштитените операции (менување статус, community корисници).
// Backend-от го враќа при успешна админ најава; се памети локално по сесија.
// VITE_ADMIN_TOKEN останува како fallback за локален развој.
const ADMIN_TOKEN_KEY = 'ekoskopje.adminToken'

export function setStoredAdminToken(token) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token)
    else localStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch { /* localStorage недостапен — тивко игнорирај */ }
}

function getAdminToken() {
  try {
    const stored = (localStorage.getItem(ADMIN_TOKEN_KEY) || '').trim()
    if (stored) return stored
  } catch { /* ignore */ }
  return (import.meta.env.VITE_ADMIN_TOKEN || '').trim()
}

export function getStoredAdminToken() {
  return getAdminToken()
}

// Го брише кешираниот ETag за условно GET — по мутации (пр. статус) да се врати свеж одговор.
export function clearConditionalEtag(url) {
  etagStore.delete(url)
}

export const apiBase = API_URL

// Сигнал дека серверот вратил 304 (истите податоци) — повикувачот треба да ја
// задржи постоечката состојба и да не прави ре-рендер.
export const NOT_MODIFIED = Symbol('not-modified')

// Складиште на ETag-ови по URL за условни барања (If-None-Match). Кога серверот
// одговори со 304, огромно мнозинство polling барања поминуваат без тело —
// суштинско за скалирање на многу истовремени корисници.
const etagStore = new Map()

// Спречува паралелни идентични GET барања (пр. React StrictMode двоен mount).
const inflightGets = new Map()
function dedupeGet(key, fn) {
  const existing = inflightGets.get(key)
  if (existing) return existing
  const p = fn().finally(() => inflightGets.delete(key))
  inflightGets.set(key, p)
  return p
}

// GET со условно барање: праќа If-None-Match; при 304 враќа NOT_MODIFIED.
async function conditionalGet(url, signal, errorMsg) {
  const headers = {}
  const prev = etagStore.get(url)
  if (prev) headers['If-None-Match'] = prev
  const res = await fetch(url, { headers, signal })
  if (res.status === 304) return NOT_MODIFIED
  if (!res.ok) throw new Error(errorMsg)
  const etag = res.headers.get('ETag')
  if (etag) etagStore.set(url, etag)
  return res.json()
}

// Проверка дали backend-от е достапен.
export async function apiHealth(signal) {
  try {
    const res = await fetch(`${API_URL}/api/health`, { signal })
    return res.ok
  } catch {
    return false
  }
}

// dataURL (од камера) → Blob, за прикачување како фајл.
function dataUrlToBlob(dataUrl) {
  const [head, body] = String(dataUrl).split(',')
  const mime = /:(.*?);/.exec(head)?.[1] || 'image/jpeg'
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// Прикачува слики (низа dataURL) и враќа низа јавни URL-и.
export async function uploadPhotos(dataUrls, signal) {
  const list = (dataUrls || []).filter(Boolean)
  if (list.length === 0) return []
  const form = new FormData()
  list.forEach((d, i) => {
    const blob = dataUrlToBlob(d)
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
    form.append('files', blob, `photo-${i + 1}.${ext}`)
  })
  const res = await fetch(`${API_URL}/api/uploads`, { method: 'POST', body: form, signal })
  if (!res.ok) throw new Error('Прикачувањето на слики не успеа.')
  const data = await res.json()
  return data.urls || []
}

export async function createReport(payload, signal) {
  const res = await fetch(`${API_URL}/api/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) throw new Error('Зачувувањето на пријавата не успеа.')
  return res.json()
}

export async function fetchReports(signal) {
  return conditionalGet(`${API_URL}/api/reports`, signal, 'Вчитувањето на пријавите не успеа.')
}

export async function updateReportStatus(id, status, extra = {}, signal) {
  const headers = { 'Content-Type': 'application/json' }
  const adminToken = getAdminToken()
  if (adminToken) headers['X-Admin-Token'] = adminToken
  const res = await fetch(`${API_URL}/api/reports/${id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status, ...extra }),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Ажурирањето на статусот не успеа.')
  clearConditionalEtag(`${API_URL}/api/reports`)
  return data
}

// Креира пријава со слики во ЕДНО multipart барање. Сликите одат како бинарни
// фајлови и backend-от ги складира како BYTEA во колоните photo_1..photo_6
// (сликите остануваат во PostgreSQL база, без надворешен диск/storage).
export async function persistReportWithPhotos({ dataUrls = [], ...payload }, signal) {
  const photos = (dataUrls || []).filter(Boolean)
  // Без слики → едноставен JSON повик.
  if (photos.length === 0) return createReport(payload, signal)

  const form = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value != null) form.append(key, String(value))
  })
  photos.slice(0, 6).forEach((dataUrl, i) => {
    const blob = dataUrlToBlob(dataUrl)
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
    form.append('photos', blob, `photo-${i + 1}.${ext}`)
  })
  // Не задавај Content-Type рачно — прелистувачот сам додава multipart boundary.
  const res = await fetch(`${API_URL}/api/reports`, { method: 'POST', body: form, signal })
  if (!res.ok) throw new Error('Зачувувањето на пријавата не успеа.')
  return res.json()
}

// ---- Настани ----

export async function fetchEvents(email, signal) {
  const q = email ? `?email=${encodeURIComponent(email)}` : ''
  return conditionalGet(`${API_URL}/api/events${q}`, signal, 'Вчитувањето на настаните не успеа.')
}

export async function createEventApi(payload, signal) {
  const res = await fetch(`${API_URL}/api/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Креирањето на настанот не успеа.')
  return data
}

export async function signupEventApi(id, payload, signal) {
  const res = await fetch(`${API_URL}/api/events/${id}/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Пријавувањето не успеа.')
  return data
}

export async function leaveEventApi(id, email, signal) {
  const res = await fetch(`${API_URL}/api/events/${id}/signup?email=${encodeURIComponent(email)}`, {
    method: 'DELETE', signal,
  })
  if (!res.ok) throw new Error('Откажувањето не успеа.')
  return res.json()
}

export async function fetchEventSignupsApi(eventId, email, signal) {
  const res = await fetch(
    `${API_URL}/api/events/${eventId}/signups?email=${encodeURIComponent(email)}`,
    { signal, cache: 'no-store' },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Вчитувањето на пријавените не успеа.')
  return data
}

// Откажување/бришење на цел настан (организатор или админ) — исчезнува за сите.
export async function deleteEventApi(id, email, signal) {
  const qs = email ? `?email=${encodeURIComponent(email)}` : ''
  const res = await fetch(`${API_URL}/api/events/${id}${qs}`, {
    method: 'DELETE',
    headers: getAdminToken() ? { 'X-Admin-Token': getAdminToken() } : {},
    signal,
  })
  if (!res.ok) throw new Error('Откажувањето на настанот не успеа.')
  return res.json()
}

// ---- Известувања ----

export async function fetchNotifications(email, signal) {
  const q = email ? `?email=${encodeURIComponent(email)}` : ''
  const res = await fetch(`${API_URL}/api/notifications${q}`, { signal })
  if (!res.ok) throw new Error('Вчитувањето на известувањата не успеа.')
  return res.json()
}

export async function createNotificationApi(payload, signal) {
  const res = await fetch(`${API_URL}/api/notifications`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal,
  })
  if (!res.ok) throw new Error('Креирањето на известувањето не успеа.')
  return res.json()
}

export async function markNotificationReadApi(id, signal) {
  const res = await fetch(`${API_URL}/api/notifications/${id}/read`, { method: 'PATCH', signal })
  if (!res.ok) throw new Error('Означувањето не успеа.')
  return res.json()
}

export async function markAllNotificationsReadApi(email, signal) {
  const res = await fetch(`${API_URL}/api/notifications/read-all`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }), signal,
  })
  if (!res.ok) throw new Error('Означувањето не успеа.')
  return res.json()
}

// ---- Лидерборд ----

export async function fetchLeaderboard(signal) {
  return conditionalGet(`${API_URL}/api/leaderboard`, signal, 'Вчитувањето на лидербордот не успеа.')
}

// Ранг на конкретен корисник меѓу СИТЕ корисници (не само топ 100 од листата).
// Враќа { points, rank } или null ако backend е недостапен.
export async function fetchMyLeaderboardRank(email, _signal) {
  const e = String(email || '').trim()
  if (!e) return null
  return dedupeGet(`leaderboard:me:${e.toLowerCase()}`, async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/leaderboard/me?email=${encodeURIComponent(e)}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  })
}

// ---- Воздух: нереферентни (граѓански) сензори од Pulse.eco (преку backend) ----

// Ги враќа граѓанските сензори во живо. Ако backend/Pulse.eco е недостапен → [].
// dedupeGet + без AbortSignal: StrictMode/remount не откажуваат успешен snapshot повик.
export async function fetchPulseSensors(_signal) {
  return dedupeGet('air:pulse', async () => {
    try {
      const res = await fetch(`${API_URL}/api/air/pulse`, { cache: 'no-store' })
      if (res.status === 304) return []
      if (!res.ok) return []
      const text = await res.text()
      if (!text) return []
      const data = JSON.parse(text)
      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  })
}

// Сензори на Град Скопје (category='city') од базата. Мрежата на Градот
// (по 1 сензор во секоја општина) моментално не е активна → обично [].
export async function fetchCitySensors(_signal) {
  return dedupeGet('air:city', async () => {
    try {
      const res = await fetch(`${API_URL}/api/air/city`, { cache: 'no-store' })
      if (!res.ok) return []
      const rows = await res.json()
      return rows
        .filter((r) => r.lat != null && r.lng != null && r.aqi != null)
        .map((r) => ({
          id: r.id, name: r.name, area: r.area || '', category: 'city',
          source: r.source || 'Град Скопје', lat: Number(r.lat), lng: Number(r.lng),
          aqi: Number(r.aqi), pm25: r.pm25 != null ? Number(r.pm25) : null,
          pm10: r.pm10 != null ? Number(r.pm10) : null, status: r.status || null,
        }))
    } catch {
      return []
    }
  })
}

// ---- Јавни точки за отпад (OSM преку backend) ----

// Сите точки од OpenStreetMap: рециклирање, јавни корпи, контејнери за отпад.
// Ако backend/Overpass е недостапен → [] (страницата има статичен fallback).
export async function fetchContainerPoints(signal) {
  try {
    const res = await fetch(`${API_URL}/api/containers/points`, { signal })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// ---- Push токени на уреди ----

// Го зачувува FCM токенот на уредот на backend (по корисник/уред).
export async function registerDeviceTokenApi({ token, email, deviceId, platform }, signal) {
  const res = await fetch(`${API_URL}/api/devices/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email, deviceId, platform }), signal,
  })
  if (!res.ok) throw new Error('Регистрацијата на токенот не успеа.')
  return res.json()
}

// ---- Автентикација (регистрација / најава со лозинка) ----

// Регистрира нов корисник со лозинка. Враќа {id,email,role,displayName,language}.
// Админ: листа на influencer/community корисници.
export async function fetchCommunityUsersApi(signal) {
  return dedupeGet('community-users', async () => {
    const res = await fetch(`${API_URL}/api/users/community`, {
      headers: getAdminToken() ? { 'X-Admin-Token': getAdminToken() } : {},
      signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Не успеа вчитувањето на корисници.')
    return data
  })
}

// Админ: додади/унапреди influencer/community корисник (улога 'organization').
export async function addCommunityUserApi({ email, displayName, organizationName, password, language }, signal) {
  const headers = { 'Content-Type': 'application/json' }
  const adminToken = getAdminToken()
  if (adminToken) headers['X-Admin-Token'] = adminToken
  const payload = { email, displayName, organizationName, language }
  if (password) payload.passwordHash = await hashPasswordForTransit(password)
  const res = await fetch(`${API_URL}/api/users/community`, {
    method: 'POST', headers,
    body: JSON.stringify(payload), signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Додавањето на корисник не успеа.')
  return data
}

// Админ: симни community корисник назад на обичен корисник.
export async function removeCommunityUserApi(email, signal) {
  const res = await fetch(`${API_URL}/api/users/community/${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: getAdminToken() ? { 'X-Admin-Token': getAdminToken() } : {},
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Отстранувањето не успеа.')
  return data
}

export async function registerApi({ email, password, displayName, language }, signal) {
  const passwordHash = await hashPasswordForTransit(password)
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, passwordHash, displayName, language }), signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Регистрацијата не успеа.')
  return data
}

// Најава со е-пошта + лозинка. Враќа профил или фрла грешка при погрешни податоци.
export async function loginApi({ email, password }, signal) {
  const passwordHash = await hashPasswordForTransit(password)
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, passwordHash }), signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Најавата не успеа.')
  return data
}

// Трајно бришење на сметка (со потврда на лозинка). Барање на Play/App Store.
export async function deleteAccountApi({ email, password }, signal) {
  const passwordHash = await hashPasswordForTransit(password)
  const res = await fetch(`${API_URL}/api/auth/account`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, passwordHash }), signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Бришењето не успеа.')
  return data
}

// ---- Корисник / јазик ----

// Го зема профилот на корисникот (вкл. избран јазик) по email.
export async function fetchUser(email, signal) {
  const res = await fetch(`${API_URL}/api/users?email=${encodeURIComponent(email)}`, { signal })
  if (!res.ok) throw new Error('Вчитувањето на корисникот не успеа.')
  return res.json()
}

// Го зачувува избраниот јазик на корисникот во базата.
export async function saveUserLanguage(email, language, signal) {
  return updateUserSettingsApi({ email, language }, signal)
}

// PATCH /api/users/settings — профил и поставки (име, јазик, нотификации).
export async function updateUserSettingsApi({ email, displayName, language, notifAir, notifWaste, notifEvents }, signal) {
  const res = await fetch(`${API_URL}/api/users/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, displayName, language, notifAir, notifWaste, notifEvents }),
    signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Зачувувањето на поставките не успеа.')
  return data
}

// ---- Трансформации: серверски ред (type + photo_1..6) → облици во frontend ----

// Backend-от враќа релативни патеки за слики (/api/reports/…/photos/n).
// Тука се претвораат во апсолутни со API_URL — потребно за локален развој
// (Vite на 5173, API на 4000) и за мобилните апликации (Capacitor).
// Старите апсолутни URL-и (http…) поминуваат непроменети.
function photoUrl(p) {
  return p && p.startsWith('/') ? `${API_URL}${p}` : p
}
function photoUrls(r) {
  return (r.photos || []).map(photoUrl)
}

export function serverToWaste(r) {
  return {
    id: r.id,
    location: r.location_label,
    municipality: r.municipality || '',
    lat: r.lat,
    lng: r.lng,
    description: r.description,
    status: r.status,
    visibility: r.visibility,
    institutionId: r.institution_id,
    reportedBy: r.reporter_name,
    reportedById: r.reporter_id,
    reportedByDevice: r.reporter_device_id || null,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    photos: photoUrls(r),
    photo: photoUrls(r)[0] || '',
  }
}

export function serverToContainer(r) {
  return {
    id: r.id,
    area: r.location_label,
    municipality: r.municipality || '',
    lat: r.lat,
    lng: r.lng,
    // null = непозната пополнетост (не се прикажува), никогаш измислена вредност.
    fill: r.fill_percent ?? null,
    issue: r.container_issue || 'full',
    kind: r.container_kind_id || 'mesan',
    description: r.description,
    institutionId: r.institution_id,
    issueOpen: r.status !== 'resolved',
    reportedBy: r.reporter_name,
    reportedById: r.reporter_id,
    reportedByDevice: r.reporter_device_id || null,
    nearestPointId: r.nearest_point_id || null,
    nearestPointType: r.nearest_point_type || null,
    nearestDistanceM: r.nearest_point_distance_m ?? null,
    createdAt: r.created_at,
    photos: photoUrls(r),
    photo: photoUrls(r)[0] || '',
  }
}

export function serverToSmell(r) {
  const isAirSensor = r.nearest_point_type === 'air_sensor'
  return {
    id: r.id,
    location: r.location_label,
    municipality: r.municipality || '',
    lat: r.lat,
    lng: r.lng,
    message: r.description,
    intensity: r.intensity,
    severity: r.severity,
    institutionId: r.institution_id,
    createdBy: r.reporter_name,
    createdAt: r.created_at,
    nearestSensorId: isAirSensor ? r.nearest_point_id : null,
    nearestSensorDistanceM: isAirSensor ? (r.nearest_point_distance_m ?? null) : null,
  }
}
