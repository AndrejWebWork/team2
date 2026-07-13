import { Capacitor } from '@capacitor/core'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  NOT_MODIFIED,
  createEventApi,
  createNotificationApi,
  deleteEventApi,
  fetchEvents,
  fetchLeaderboard,
  fetchNotifications,
  fetchReports,
  fetchUser,
  leaveEventApi,
  loginApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  persistReportWithPhotos,
  registerApi,
  registerDeviceTokenApi,
  saveUserLanguage,
  setStoredAdminToken,
  serverToContainer,
  serverToSmell,
  serverToWaste,
  signupEventApi,
  updateReportStatus,
} from '../lib/api'
import { getDeviceId } from '../lib/device'
import { resolveMunicipality } from '../lib/geo'
import { registerPushNotifications, scheduleLocalNotification } from '../lib/notifications'
import { DEFAULT_LANGUAGE, isSupportedLanguage, translate } from '../i18n/translations'

const AppContext = createContext(null)

const LANG_STORAGE_KEY = 'ekoskopje.language'
const AUTH_STORAGE_KEY = 'ekoskopje.auth'
const REPORTS_CACHE_KEY = 'ekoskopje.reports.cache'

const ANON_AUTH = { isAuthenticated: true, role: 'user', email: '', displayName: '', isAnonymous: true }

// Сесијата преживува рестарт: најавениот корисник се памти локално (по уред).
function readStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : null
    if (data && data.email && !data.isAnonymous) {
      return { isAuthenticated: true, role: data.role || 'user', email: data.email, displayName: data.displayName || '', isAnonymous: false }
    }
    return ANON_AUTH
  } catch {
    return ANON_AUTH
  }
}
// Колку често се освежуваат податоците од backend (real-time приказ ~10s).
const POLL_INTERVAL_MS = 10000
// Случаен растур (jitter) за да не удрат сите клиенти истовремено (spikes).
const POLL_JITTER_MS = 3000
// Стабилен идентитет на уредот за анонимни корисници (кеш по уред).
const DEVICE_ID = getDeviceId()

// Известувањата на АНОНИМЕН корисник се чуваат локално по уред (без најава).
function notifCacheKey(identity) {
  return `ekoskopje.notifications.${identity}`
}
function readCachedNotifications(identity) {
  try {
    const raw = localStorage.getItem(notifCacheKey(identity))
    const data = raw ? JSON.parse(raw) : null
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
function writeCachedNotifications(identity, list) {
  try {
    localStorage.setItem(notifCacheKey(identity), JSON.stringify(list.slice(0, 100)))
  } catch {
    /* localStorage полн/недостапен — тивко игнорирај */
  }
}

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

// Го чита последниот кеширан снимок на пријавите (од кога backend-от бил онлајн).
function readCachedReports() {
  try {
    const raw = localStorage.getItem(REPORTS_CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.waste)) return null
    return {
      waste: data.waste || [],
      containers: data.containers || [],
      smell: data.smell || [],
      cachedAt: data.cachedAt || null,
    }
  } catch {
    return null
  }
}

// Го зачувува последниот успешен снимок од базата, за офлајн вчитување.
function writeCachedReports({ waste, containers, smell }) {
  try {
    localStorage.setItem(
      REPORTS_CACHE_KEY,
      JSON.stringify({ waste, containers, smell, cachedAt: new Date().toISOString() }),
    )
  } catch {
    /* localStorage полн/недостапен — тивко игнорирај */
  }
}

export function AppProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth)
  // Сите податоци се РЕАЛНИ: сензорите доаѓаат во живо од WAQI (во AirPage),
  // а пријавите од backend-от. Нема измислени (mock) почетни податоци.
  const [sensors, setSensors] = useState([])
  const [smellAlerts, setSmellAlerts] = useState([])
  const [wasteReports, setWasteReports] = useState([])
  const [containers, setContainers] = useState([])
  const [events, setEvents] = useState([])
  const [notifications, setNotifications] = useState(() => readCachedNotifications(DEVICE_ID))
  const [pointsLedger, setPointsLedger] = useState({})
  const [pointsEvents, setPointsEvents] = useState([])
  const [serverLeaderboard, setServerLeaderboard] = useState([])
  const [apiOnline, setApiOnline] = useState(null) // null=непознато, true/false
  const [language, setLanguageState] = useState(readStoredLanguage)
  // Рачно освежување: покачувањето предизвикува веднаш нов циклус на вчитување
  // (пр. по успешна пријава/промена на статус/настан — без да се чека поллот).
  const [refreshKey, setRefreshKey] = useState(0)

  const email = auth.email || null

  // Сите податоци се РЕАЛНИ и во живо:
  //  • backend достапен → единствен извор; се освежуваат на ~POLL_INTERVAL_MS
  //    (real-time), пријавите се кешираат по уред за офлајн.
  //  • backend недостапен → пријавите се вчитуваат од последниот кеш на овој уред.
  // Известувањата на анонимен корисник живеат локално по уред; на регистриран од базата.
  //
  // Оптимизации за голем број корисници (пр. 200.000 истовремено):
  //  • Условни барања (ETag/If-None-Match): при 304 не праќаме тело и не
  //    правиме ре-рендер (NOT_MODIFIED).
  //  • Нема одвоена health-проверка по циклус — статусот се изведува од самото
  //    вчитување (една тура барања помалку по корисник).
  //  • Паузирање кога табот е скриен (Page Visibility) + jitter против „spikes“.
  useEffect(() => {
    let cancelled = false
    let timer = null
    const controller = new AbortController()

    const loadFromCache = () => {
      const cached = readCachedReports()
      if (!cached) return
      setWasteReports(cached.waste)
      setContainers(cached.containers)
      setSmellAlerts(cached.smell)
    }

    async function sync(initial) {
      try {
        const [rows, evts, board] = await Promise.all([
          fetchReports(controller.signal),
          fetchEvents(email, controller.signal),
          fetchLeaderboard(controller.signal),
        ])
        if (cancelled) return
        setApiOnline(true)
        // Секој извор се ажурира само ако навистина се сменил (инаку 304).
        if (rows !== NOT_MODIFIED) {
          const waste = rows.filter((r) => r.type === 'waste').map(serverToWaste)
          const containers = rows.filter((r) => r.type === 'container').map(serverToContainer)
          const smell = rows.filter((r) => r.type === 'smell').map(serverToSmell)
          setWasteReports(waste)
          setContainers(containers)
          setSmellAlerts(smell)
          writeCachedReports({ waste, containers, smell })
        }
        if (evts !== NOT_MODIFIED) setEvents(evts)
        if (board !== NOT_MODIFIED) setServerLeaderboard(board)
        // Известувања: за регистриран корисник backend е извор; анонимен = локално.
        if (email) {
          const notifs = await fetchNotifications(email, controller.signal)
          if (!cancelled && notifs !== NOT_MODIFIED) setNotifications(notifs)
        }
      } catch {
        if (cancelled) return
        setApiOnline(false)
        if (initial) loadFromCache()
      }
    }

    const scheduleNext = () => {
      if (cancelled) return
      timer = setTimeout(tick, POLL_INTERVAL_MS + Math.random() * POLL_JITTER_MS)
    }
    async function tick() {
      // Не троши барања додека табот е скриен — освежуваме кога ќе се врати.
      if (!document.hidden) await sync(false)
      scheduleNext()
    }
    const onVisibility = () => { if (!document.hidden) sync(false) }

    sync(true).finally(scheduleNext)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      controller.abort()
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [email, refreshKey])

  // Веднаш повлечи свежи податоци од backend (по запис што менува состојба).
  function refreshData() {
    setRefreshKey((k) => k + 1)
  }

  // Анонимните известувања се чуваат локално по уред (за да преживеат освежување).
  useEffect(() => {
    if (!email) writeCachedNotifications(DEVICE_ID, notifications)
  }, [notifications, email])

  // Push (FCM) регистрација — само на телефон и само за не-админ корисници.
  // Токенот се врзува за корисникот (ако е најавен) или за анонимниот уред.
  const pushTokenRef = useRef(null)
  const pushInitRef = useRef(false)
  useEffect(() => {
    if (auth.role === 'admin' || pushInitRef.current) return
    pushInitRef.current = true
    registerPushNotifications({
      onToken: (token) => {
        pushTokenRef.current = token
        registerDeviceTokenApi({ token, email: auth.email || null, deviceId: DEVICE_ID, platform: Capacitor.getPlatform() }).catch(() => {})
      },
      onReceived: (n) => {
        const title = n?.title || n?.notification?.title || ''
        const body = n?.body || n?.notification?.body || ''
        if (title) {
          setNotifications((prev) => [{ id: `push-${Date.now()}`, title, body, group: 'Денес', read: false, createdAt: new Date().toISOString() }, ...prev])
        }
      },
    })
  }, [auth.role, auth.email])

  // Кога корисникот ќе се најави/одјави, повторно врзи го токенот за точниот идентитет.
  useEffect(() => {
    if (auth.role === 'admin' || !pushTokenRef.current) return
    registerDeviceTokenApi({ token: pushTokenRef.current, email: auth.email || null, deviceId: DEVICE_ID, platform: Capacitor.getPlatform() }).catch(() => {})
  }, [auth.email, auth.role])

  // Ја чуваме сесијата локално за да преживее рестарт (анонимен = избришано).
  useEffect(() => {
    try {
      if (auth.email && !auth.isAnonymous) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ role: auth.role, email: auth.email, displayName: auth.displayName || '', isAnonymous: false }))
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    } catch { /* localStorage недостапен — тивко игнорирај */ }
    // Одјава/не-админ сесија → админ токенот не смее да остане на уредот.
    if (auth.role !== 'admin') setStoredAdminToken('')
  }, [auth.email, auth.role, auth.displayName, auth.isAnonymous])

  // Го применуваме избраниот јазик на <html lang> (пристапност + SEO).
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  // При најава: го вчитуваме зачуваниот јазик на корисникот од базата (ако е достапна).
  useEffect(() => {
    if (!auth.email || !apiOnline) return
    const controller = new AbortController()
    ;(async () => {
      try {
        const user = await fetchUser(auth.email, controller.signal)
        if (user?.language && isSupportedLanguage(user.language)) {
          setLanguageState(user.language)
          try { localStorage.setItem(LANG_STORAGE_KEY, user.language) } catch { /* ignore */ }
        }
        // Освежи го прикажаното име (име и презиме од регистрација) на релоуд.
        if (user?.display_name) {
          setAuth((prev) => (prev.displayName === user.display_name ? prev : { ...prev, displayName: user.display_name }))
        }
      } catch {
        /* корисникот сè уште не постои во база — останува локалниот избор */
      }
    })()
    return () => controller.abort()
  }, [auth.email, apiOnline])

  // Менување јазик: локална state + localStorage + (ако сме најавени) во базата.
  function setLanguage(lang) {
    if (!isSupportedLanguage(lang)) return
    setLanguageState(lang)
    try { localStorage.setItem(LANG_STORAGE_KEY, lang) } catch { /* ignore */ }
    if (auth.email) {
      saveUserLanguage(auth.email, lang).catch(() => { /* офлајн: останува локално */ })
    }
  }

  const t = useMemo(() => (key, vars) => translate(language, key, vars), [language])

  const unreadCount = notifications.filter((n) => !n.read).length
  const currentUserId = auth.email || DEVICE_ID

  // Локален леџер: за анонимни (по уред) и за оптимистичка повратна информација.
  // За регистрирани корисници вистинските поени доаѓаат од backend (serverLeaderboard).
  function awardPoints(userId, amount) {
    const target = userId || DEVICE_ID
    setPointsLedger((prev) => ({ ...prev, [target]: (prev[target] || 0) + amount }))
    setPointsEvents((prev) => [...prev, { userId: target, points: amount, createdAt: new Date().toISOString() }])
  }

  // Ново известување: оптимистички локално + (ако сме најавени) во базата +
  // телефонска локална нотификација (не за админ — таму не е потребно).
  function pushNotification({ title, body }) {
    const optimistic = { id: `local-${Date.now()}`, title, body, group: 'Денес', read: false, createdAt: new Date().toISOString() }
    setNotifications((prev) => [optimistic, ...prev])
    if (email) createNotificationApi({ title, body, email }).catch(() => {})
    if (auth.role !== 'admin') scheduleLocalNotification({ title, body })
  }

  function markNotificationRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    if (email && typeof id === 'string' && !id.startsWith('local-')) {
      // По потврда од серверот освежи — поллот во тек може да врати стара
      // листа и да го „врати" непрочитаното; вака состојбата конвергира.
      markNotificationReadApi(id).then(() => refreshData()).catch(() => {})
    }
  }

  function markAllNotifications() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (email) markAllNotificationsReadApi(email).then(() => refreshData()).catch(() => {})
  }

  // ---- Записи кон backend (единствен извор на вистина) ----

  // Оптимистички локален запис при офлајн (за да се види пријавата веднаш и да
  // остане во кешот на уредот додека backend-от не се врати).
  function optimisticInsertReport(p) {
    const now = new Date().toISOString()
    const reportedBy = auth.email || t('common.anonymousCitizen')
    if (p.type === 'smell') {
      setSmellAlerts((prev) => [{
        id: `local-${Date.now()}`, location: p.location, lat: p.lat, lng: p.lng,
        message: p.description || '', intensity: p.intensity || 3,
        severity: (p.intensity || 3) >= 4 ? 'critical' : 'warning',
        createdBy: reportedBy, createdAt: now,
      }, ...prev])
    } else if (p.type === 'waste') {
      setWasteReports((prev) => [{
        id: `local-${Date.now()}`, location: p.location, lat: p.lat, lng: p.lng,
        description: p.description || '', status: 'pending', visibility: 'admin',
        reportedBy, reportedById: currentUserId, reportedByDevice: DEVICE_ID, createdAt: now,
        photo: (p.dataUrls && p.dataUrls[0]) || '',
      }, ...prev])
    } else if (p.type === 'container') {
      setContainers((prev) => [{
        id: `C-local-${Date.now()}`, area: p.location, lat: p.lat, lng: p.lng,
        fill: p.fill ?? 90, issue: p.containerIssue || 'full', description: p.description || '',
        photo: (p.dataUrls && p.dataUrls[0]) || '', issueOpen: true,
        reportedBy, reportedById: currentUserId, reportedByDevice: DEVICE_ID, createdAt: now,
      }, ...prev])
    }
  }

  // Пријава (миризба/депонија/контејнер) → backend (слики како BYTEA во база).
  // Успех → веднаш освежи од сервер; офлајн → оптимистички локален запис + кеш.
  async function submitReport(payload) {
    // Општина: ако формата не ја дала, одреди ја од координатите (Nominatim).
    // Не блокира долго (timeout 6s) и при неуспех пријавата оди без општина.
    let municipality = payload.municipality || ''
    if (!municipality && payload.lat != null && payload.lng != null) {
      municipality = await resolveMunicipality(payload.lat, payload.lng)
    }
    const backendPayload = {
      type: payload.type,
      reporterId: auth.isAnonymous ? null : undefined,
      // Уредот секогаш се праќа: за анонимни тоа е ЕДИНСТВЕНАТА врска со
      // „моите пријави" на овој уред (истиот ID што се памети во локалниот кеш).
      deviceId: DEVICE_ID,
      reporterEmail: auth.email || null,
      reporterName: auth.email || null,
      location: payload.location || '',
      municipality,
      lat: payload.lat,
      lng: payload.lng,
      description: payload.description || '',
      intensity: payload.intensity ?? null,
      severity: payload.severity ?? null,
      containerKind: payload.containerKind ?? null,
      containerIssue: payload.containerIssue ?? null,
      fill: payload.fill ?? null,
      dataUrls: payload.dataUrls || [],
    }
    try {
      await persistReportWithPhotos(backendPayload)
      // Поените се доделуваат ИСКЛУЧИВО од backend и само за регистрирани
      // корисници (+1 за пријава контејнер/депонија, +2 при решавање = 3).
      // Анонимните корисници немаат поени — не се доделуваат локално.
      refreshData()
      return { ok: true }
    } catch {
      optimisticInsertReport(payload)
      return { ok: true, offline: true }
    }
  }

  // Промена на статус/решавање на пријава (админ/надлежен) → PATCH кон backend.
  async function changeReportStatus(id, status, extra = {}) {
    try {
      await updateReportStatus(id, status, extra)
      refreshData()
      return { ok: true }
    } catch {
      return { ok: false }
    }
  }

  // ---- Автентикација ----

  async function login({ email: e, password }) {
    const user = await loginApi({ email: e, password })
    // Админ токен за заштитените операции — backend го враќа само за админ.
    setStoredAdminToken(user.adminToken || '')
    setAuth({ isAuthenticated: true, role: user.role || 'user', email: user.email || e, displayName: user.displayName || '', isAnonymous: false })
    if (user.language && isSupportedLanguage(user.language)) setLanguage(user.language)
    return user
  }

  async function register({ email: e, password, displayName }) {
    const user = await registerApi({ email: e, password, displayName, language })
    setAuth({ isAuthenticated: true, role: user.role || 'user', email: user.email || e, displayName: user.displayName || displayName || '', isAnonymous: false })
    return user
  }

  // ---- Настани (заедница) ----

  async function createEvent(payload) {
    await createEventApi({ ...payload, organizerEmail: email, organizerName: payload.organizerName || email })
    refreshData()
  }
  async function joinEvent(id, payload = {}) {
    await signupEventApi(id, { email, ...payload })
    refreshData()
  }
  async function leaveEvent(id) {
    if (!email) return
    await leaveEventApi(id, email)
    refreshData()
  }
  async function deleteEvent(id) {
    await deleteEventApi(id, email)
    refreshData()
  }

  // Лидерборд: регистрираните корисници доаѓаат од backend; анонимниот уред се
  // додава од локалниот леџер (не постои во базата).
  const leaderboardMonthly = useMemo(() => {
    const map = new Map()
    serverLeaderboard.forEach((e) => map.set(e.userId, { userId: e.userId, name: e.name, points: e.points }))
    const localDevicePoints = pointsLedger[DEVICE_ID] || 0
    if (!email && localDevicePoints > 0) {
      map.set(DEVICE_ID, { userId: DEVICE_ID, points: localDevicePoints })
    }
    return [...map.values()].sort((a, b) => b.points - a.points)
  }, [serverLeaderboard, pointsLedger, email])

  const currentUserPoints = email
    ? (serverLeaderboard.find((e) => e.userId === email)?.points || 0)
    : (pointsLedger[DEVICE_ID] || 0)

  const value = useMemo(
    () => ({
      auth,
      setAuth,
      sensors,
      setSensors,
      smellAlerts,
      setSmellAlerts,
      wasteReports,
      setWasteReports,
      containers,
      setContainers,
      events,
      setEvents,
      notifications,
      setNotifications,
      pushNotification,
      markNotificationRead,
      markAllNotifications,
      unreadCount,
      pointsLedger,
      currentUserId,
      currentUserPoints,
      leaderboardMonthly,
      awardPoints,
      apiOnline,
      deviceId: DEVICE_ID,
      language,
      setLanguage,
      t,
      refreshData,
      submitReport,
      changeReportStatus,
      login,
      register,
      createEvent,
      joinEvent,
      leaveEvent,
      deleteEvent,
    }),
    [auth, sensors, smellAlerts, wasteReports, containers, events, notifications, unreadCount, pointsLedger, currentUserId, currentUserPoints, leaderboardMonthly, apiOnline, language, t],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
