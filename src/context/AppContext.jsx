import { Capacitor } from '@capacitor/core'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  NOT_MODIFIED,
  clearAllConditionalEtags,
  clearEventsEtags,
  clearReportsEtag,
  createEventApi,
  createAirAlertNotificationApi,
  createNotificationApi,
  deleteEventApi,
  deleteNotificationApi,
  fetchEvents,
  fetchLeaderboard,
  fetchMyLeaderboardRank,
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
  getStoredAdminToken,
} from '../lib/api'
import { getDeviceId } from '../lib/device'
import { isMyReport, reportsIdentity } from '../lib/reportOwnership'
import { resolveLocationInfo, findNearestContainerPoint } from '../lib/geo'
import { fetchAllAirSensors, findNearestSensor } from '../lib/smellSensor'
import { AIR_CHECK_MS, nextAirAlertState, pickAirAlertSensor } from '../lib/airAlerts'
import { captureGeolocation } from '../lib/geolocation'
import { registerPushNotifications, scheduleLocalNotification } from '../lib/notifications'
import { DEFAULT_LANGUAGE, isSupportedLanguage, translate } from '../i18n/translations'

const AppContext = createContext(null)

const LANG_STORAGE_KEY = 'ekoskopje.language'
const AUTH_STORAGE_KEY = 'ekoskopje.auth'
const REPORTS_CACHE_PREFIX = 'ekoskopje.reports.cache.'
const EVENTS_CACHE_PREFIX = 'ekoskopje.events.cache.'

const ANON_AUTH = { isAuthenticated: true, role: 'user', email: '', displayName: '', userId: '', isAnonymous: true }

// Сесијата преживува рестарт: најавениот корисник се памти локално (по уред).
function readStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    const data = raw ? JSON.parse(raw) : null
    if (data && data.email && !data.isAnonymous) {
      // Врати го админ токенот при рестарт — потребен за PATCH статус без повторна најава.
      if (data.role === 'admin' && data.adminToken) setStoredAdminToken(data.adminToken)
      return {
        isAuthenticated: true,
        role: data.role || 'user',
        email: data.email,
        displayName: data.displayName || '',
        userId: data.userId || '',
        isAnonymous: false,
      }
    }
    return ANON_AUTH
  } catch {
    return ANON_AUTH
  }
}
// Колку често се освежуваат податоците од backend (reports, events, leaderboard).
const POLL_INTERVAL_MS = 22000
const ADMIN_POLL_INTERVAL_MS = 12000
// Случаен растур (jitter) за да не удрат сите клиенти истовремено (spikes).
const POLL_JITTER_MS = 4000
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

function hiddenNotifCacheKey(identity) {
  return `ekoskopje.notifications.hidden.${identity}`
}
function readHiddenNotificationIds(identity) {
  try {
    const raw = localStorage.getItem(hiddenNotifCacheKey(identity))
    const data = raw ? JSON.parse(raw) : null
    return Array.isArray(data) ? data.map(String) : []
  } catch {
    return []
  }
}
function addHiddenNotificationId(identity, id) {
  try {
    const prev = readHiddenNotificationIds(identity)
    const key = String(id)
    if (prev.includes(key)) return
    localStorage.setItem(hiddenNotifCacheKey(identity), JSON.stringify([key, ...prev].slice(0, 200)))
  } catch {
    /* localStorage полн/недостапен — тивко игнорирај */
  }
}
function filterHiddenNotifications(list, identity) {
  const hidden = new Set(readHiddenNotificationIds(identity))
  if (hidden.size === 0) return list
  return list.filter((n) => !hidden.has(String(n.id)))
}

function prefsCacheKey(identity) {
  return `ekoskopje.prefs.${identity}`
}
function readPrefs(identity) {
  try {
    return JSON.parse(localStorage.getItem(prefsCacheKey(identity))) || {}
  } catch {
    return {}
  }
}
function writePrefs(identity, patch) {
  try {
    localStorage.setItem(prefsCacheKey(identity), JSON.stringify({ ...readPrefs(identity), ...patch }))
  } catch { /* ignore */ }
}

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

// Го чита последниот кеширан снимок на пријавите за даден идентитет (email или уред).
function readCachedReports(identity) {
  try {
    const raw = localStorage.getItem(`${REPORTS_CACHE_PREFIX}${identity}`)
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

// Го зачувува последниот успешен снимок од базата, по корисник/уред (како известувањата).
function writeCachedReports(identity, { waste, containers, smell }) {
  try {
    localStorage.setItem(
      `${REPORTS_CACHE_PREFIX}${identity}`,
      JSON.stringify({ waste, containers, smell, cachedAt: new Date().toISOString() }),
    )
  } catch {
    /* localStorage полн/недостапен — тивко игнорирај */
  }
}

function readCachedEvents(identity) {
  try {
    const raw = localStorage.getItem(`${EVENTS_CACHE_PREFIX}${identity}`)
    if (!raw) return null
    const data = JSON.parse(raw)
    return Array.isArray(data?.events) ? data.events : null
  } catch {
    return null
  }
}

function writeCachedEvents(identity, list) {
  try {
    localStorage.setItem(
      `${EVENTS_CACHE_PREFIX}${identity}`,
      JSON.stringify({ events: list, cachedAt: new Date().toISOString() }),
    )
  } catch {
    /* localStorage полн/недостапен — тивко игнорирај */
  }
}

const LEADERBOARD_CACHE_KEY = 'ekoskopje.leaderboard.cache'
const MY_POINTS_CACHE_PREFIX = 'ekoskopje.mypoints.'

function readCachedLeaderboard() {
  try {
    const raw = localStorage.getItem(LEADERBOARD_CACHE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function writeCachedLeaderboard(list) {
  try {
    localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(Array.isArray(list) ? list : []))
  } catch { /* ignore */ }
}

function readCachedMyPoints(email) {
  if (!email) return null
  try {
    const raw = localStorage.getItem(`${MY_POINTS_CACHE_PREFIX}${String(email).toLowerCase()}`)
    if (raw == null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function writeCachedMyPoints(email, points) {
  if (!email) return
  try {
    localStorage.setItem(`${MY_POINTS_CACHE_PREFIX}${String(email).toLowerCase()}`, String(Number(points) || 0))
  } catch { /* ignore */ }
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
  const [notifAir, setNotifAirState] = useState(true)
  const [pointsLedger, setPointsLedger] = useState({})
  const [pointsEvents, setPointsEvents] = useState([])
  // Кеш → веднаш видливи поени на старт (без чекање на reports sync).
  const [serverLeaderboard, setServerLeaderboard] = useState(readCachedLeaderboard)
  const [myServerPoints, setMyServerPoints] = useState(() => {
    try {
      const a = readStoredAuth()
      return a?.email ? readCachedMyPoints(a.email) : null
    } catch {
      return null
    }
  })
  const [apiOnline, setApiOnline] = useState(null) // null=непознато, true/false
  const [language, setLanguageState] = useState(readStoredLanguage)
  // Рачно освежување: покачувањето предизвикува веднаш нов циклус на вчитување
  // (пр. по успешна пријава/промена на статус/настан — без да се чека поллот).
  const [refreshKey, setRefreshKey] = useState(0)
  const wasteSnapRef = useRef(wasteReports)
  const containersSnapRef = useRef(containers)
  const smellSnapRef = useRef(smellAlerts)
  const notifiedResolvedRef = useRef(new Set())
  const airAlertStateRef = useRef(new Map())
  const airLocationRef = useRef(null)

  const email = auth.email || null
  const reportsIdentityKey = reportsIdentity(auth, DEVICE_ID)

  function persistReportsCache(waste, containers, smell) {
    wasteSnapRef.current = waste
    containersSnapRef.current = containers
    smellSnapRef.current = smell
    writeCachedReports(reportsIdentityKey, { waste, containers, smell })
  }

  // Веднаш ажурирај локална состојба од еден server report (POST/PATCH) — без refresh.
  function mergeReportFromServer(row) {
    if (!row?.id || !row?.type) return
    if (row.type === 'waste') {
      const mapped = serverToWaste(row)
      setWasteReports((prev) => {
        const next = prev.some((r) => r.id === mapped.id)
          ? prev.map((r) => (r.id === mapped.id ? { ...r, ...mapped } : r))
          : [mapped, ...prev]
        persistReportsCache(next, containersSnapRef.current, smellSnapRef.current)
        return next
      })
    } else if (row.type === 'container') {
      const mapped = serverToContainer(row)
      setContainers((prev) => {
        const next = prev.some((r) => r.id === mapped.id)
          ? prev.map((r) => (r.id === mapped.id ? mapped : r))
          : [mapped, ...prev]
        persistReportsCache(wasteSnapRef.current, next, smellSnapRef.current)
        return next
      })
    } else if (row.type === 'smell') {
      const mapped = serverToSmell(row)
      setSmellAlerts((prev) => {
        const next = prev.some((r) => r.id === mapped.id)
          ? prev.map((r) => (r.id === mapped.id ? { ...r, ...mapped } : r))
          : [mapped, ...prev]
        persistReportsCache(wasteSnapRef.current, containersSnapRef.current, next)
        return next
      })
    }
  }

  // При промена на корисник (најава/одјава): исчисти ја претходната состојба и повлечи свежи
  // податоци од базата — не прикажувај кеш од претходна сесија.
  useEffect(() => {
    setWasteReports([])
    setContainers([])
    setSmellAlerts([])
    setEvents(readCachedEvents(reportsIdentityKey) || [])
    setServerLeaderboard(readCachedLeaderboard())
    setMyServerPoints(auth.email ? readCachedMyPoints(auth.email) : null)
    wasteSnapRef.current = []
    containersSnapRef.current = []
    smellSnapRef.current = []
    notifiedResolvedRef.current = new Set()
    airAlertStateRef.current = new Map()
    const prefs = readPrefs(reportsIdentityKey)
    if (prefs.notifAir != null) setNotifAirState(Boolean(prefs.notifAir))
    else setNotifAirState(true)
    if (auth.email && !auth.isAnonymous) setNotifications([])
    else setNotifications(readCachedNotifications(reportsIdentityKey))
    clearAllConditionalEtags()
    setRefreshKey((k) => k + 1)
  }, [reportsIdentityKey])

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
      const cached = readCachedReports(reportsIdentityKey)
      if (cached) {
        setWasteReports(cached.waste)
        setContainers(cached.containers)
        setSmellAlerts(cached.smell)
      }
      const cachedEvents = readCachedEvents(reportsIdentityKey)
      if (cachedEvents) setEvents(cachedEvents)
    }

    let syncInFlight = false

    function notifyAnonymousReportResolved(report) {
      if (auth.role === 'admin' || email) return
      const key = String(report.id)
      if (notifiedResolvedRef.current.has(key)) return
      notifiedResolvedRef.current.add(key)
      const loc = report.location || report.area || translate(language, 'admin.unknownLocation')
      const title = translate(language, 'notif.reportResolvedTitle')
      const body = translate(language, 'notif.reportResolvedBody', { loc })
      setNotifications((prev) => {
        const id = `resolved-${key}`
        if (prev.some((n) => n.id === id)) return prev
        return [{
          id,
          title,
          body,
          group: translate(language, 'group.today'),
          read: false,
          createdAt: new Date().toISOString(),
        }, ...prev]
      })
      scheduleLocalNotification({ title, body })
    }

    function detectAnonymousResolved(prevWaste, nextWaste, prevContainers, nextContainers) {
      if (auth.role === 'admin' || email) return
      for (const r of nextWaste) {
        if (!isMyReport(r, auth, DEVICE_ID)) continue
        const prev = prevWaste.find((p) => p.id === r.id)
        if (prev && prev.status !== 'resolved' && r.status === 'resolved') {
          notifyAnonymousReportResolved(r)
        }
      }
      for (const r of nextContainers) {
        if (!isMyReport(r, auth, DEVICE_ID)) continue
        const prev = prevContainers.find((p) => p.id === r.id)
        if (prev && prev.issueOpen && !r.issueOpen) {
          notifyAnonymousReportResolved(r)
        }
      }
    }

    async function sync(initial) {
      if (syncInFlight) return
      syncInFlight = true
      try {
        // Поените/лидербордот се применуваат ШТОМ стигнат — не чекаат reports.
        const boardPromise = fetchLeaderboard(controller.signal).then((board) => {
          if (cancelled || board === NOT_MODIFIED) return board
          setServerLeaderboard(board)
          writeCachedLeaderboard(board)
          return board
        })
        const [rows, evts] = await Promise.all([
          fetchReports(controller.signal),
          fetchEvents(email, controller.signal),
        ])
        if (cancelled) return
        setApiOnline(true)
        // Секој извор се ажурира само ако навистина се сменил (инаку 304).
        if (rows !== NOT_MODIFIED) {
          const waste = rows.filter((r) => r.type === 'waste').map(serverToWaste)
          const containers = rows.filter((r) => r.type === 'container').map(serverToContainer)
          const smell = rows.filter((r) => r.type === 'smell').map(serverToSmell)
          detectAnonymousResolved(wasteSnapRef.current, waste, containersSnapRef.current, containers)
          wasteSnapRef.current = waste
          containersSnapRef.current = containers
          smellSnapRef.current = smell
          setWasteReports(waste)
          setContainers(containers)
          setSmellAlerts(smell)
          writeCachedReports(reportsIdentityKey, { waste, containers, smell })
        }
        if (evts !== NOT_MODIFIED) {
          setEvents(evts)
          writeCachedEvents(reportsIdentityKey, evts)
        }
        await boardPromise
        // Известувања: за регистриран корисник backend е извор; анонимен = локално.
        if (email) {
          const notifs = await fetchNotifications(email, controller.signal)
          if (!cancelled && notifs !== NOT_MODIFIED) {
            setNotifications(filterHiddenNotifications(notifs, reportsIdentityKey))
          }
        }
      } catch {
        if (cancelled) return
        setApiOnline(false)
        if (initial) loadFromCache()
      } finally {
        syncInFlight = false
      }
    }

    const pollMs = auth.role === 'admin' ? ADMIN_POLL_INTERVAL_MS : POLL_INTERVAL_MS

    const scheduleNext = () => {
      if (cancelled) return
      timer = setTimeout(tick, pollMs + Math.random() * POLL_JITTER_MS)
    }
    async function tick() {
      // Не троши барања додека табот е скриен — освежуваме кога ќе се врати.
      if (!document.hidden) await sync(false)
      scheduleNext()
    }
    const onVisibility = () => { if (!document.hidden) sync(false) }
    const onFocus = () => { if (!document.hidden) sync(false) }

    sync(true).finally(scheduleNext)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      cancelled = true
      controller.abort()
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [reportsIdentityKey, refreshKey, language, auth.email, auth.role, auth.isAnonymous])

  // Брзи поени за најавен корисник (лек endpoint) — независно од тешкиот reports sync.
  useEffect(() => {
    if (!email) {
      setMyServerPoints(null)
      return undefined
    }
    let cancelled = false
    fetchMyLeaderboardRank(email).then((r) => {
      if (cancelled || !r || r.points == null) return
      const pts = Number(r.points) || 0
      setMyServerPoints(pts)
      writeCachedMyPoints(email, pts)
    })
    return () => { cancelled = true }
  }, [email, refreshKey])

  // Веднаш повлечи свежи податоци од backend (по запис што менува состојба).
  function refreshData() {
    clearAllConditionalEtags()
    setRefreshKey((k) => k + 1)
  }

  // Само настани — побрз refresh без да ги повторува reports/leaderboard.
  const refreshEvents = useCallback(async () => {
    clearEventsEtags(email || null)
    try {
      const evts = await fetchEvents(email || null)
      if (evts !== NOT_MODIFIED) {
        setEvents(evts)
        writeCachedEvents(reportsIdentityKey, evts)
      }
    } catch {
      /* тивко — polling ќе проба повторно */
    }
  }, [email, reportsIdentityKey])

  const refreshReports = useCallback(async () => {
    clearReportsEtag()
    try {
      const rows = await fetchReports()
      if (rows === NOT_MODIFIED) return
      const waste = rows.filter((r) => r.type === 'waste').map(serverToWaste)
      const containers = rows.filter((r) => r.type === 'container').map(serverToContainer)
      const smell = rows.filter((r) => r.type === 'smell').map(serverToSmell)
      wasteSnapRef.current = waste
      containersSnapRef.current = containers
      smellSnapRef.current = smell
      setWasteReports(waste)
      setContainers(containers)
      setSmellAlerts(smell)
      writeCachedReports(reportsIdentityKey, { waste, containers, smell })
    } catch {
      /* тивко — polling ќе проба повторно */
    }
  }, [reportsIdentityKey])

  const logout = useCallback(() => {
    setStoredAdminToken('')
    setPointsLedger({})
    setPointsEvents([])
    setAuth(ANON_AUTH)
  }, [])

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
        const payload = { role: auth.role, email: auth.email, displayName: auth.displayName || '', userId: auth.userId || '', isAnonymous: false }
        if (auth.role === 'admin') {
          const token = getStoredAdminToken()
          if (token) payload.adminToken = token
        }
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
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
        if (user?.id) {
          setAuth((prev) => (prev.userId === user.id ? prev : { ...prev, userId: user.id }))
        }
        if (user?.notif_air != null) {
          setNotifAirState(Boolean(user.notif_air))
          writePrefs(reportsIdentityKey, { notifAir: Boolean(user.notif_air) })
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

  const setNotifAir = useCallback((value) => {
    const next = Boolean(value)
    setNotifAirState(next)
    writePrefs(reportsIdentityKey, { notifAir: next })
  }, [reportsIdentityKey])

  const unreadCount = notifications.filter((n) => !n.read).length
  const currentUserId = auth.email || DEVICE_ID

  // Локален леџер: за анонимни (по уред) и за оптимистичка повратна информација.
  // За регистрирани корисници вистинските поени доаѓаат од backend (serverLeaderboard).
  function awardPoints(userId, amount) {
    const target = userId || DEVICE_ID
    setPointsLedger((prev) => ({ ...prev, [target]: (prev[target] || 0) + amount }))
    setPointsEvents((prev) => [...prev, { userId: target, points: amount, createdAt: new Date().toISOString() }])
    if (email && (target === email || target === currentUserId)) {
      setMyServerPoints((prev) => {
        const next = (prev != null ? prev : 0) + amount
        writeCachedMyPoints(email, next)
        return next
      })
    }
  }

  // In-app известување без телефонски banner/push (пр. AQI аларм).
  function pushInAppNotification({ title, body }) {
    const optimistic = {
      id: `local-${Date.now()}`,
      title,
      body,
      group: translate(language, 'group.today'),
      read: false,
      createdAt: new Date().toISOString(),
    }
    setNotifications((prev) => [optimistic, ...prev])
    if (email) createAirAlertNotificationApi({ email, title, body }).catch(() => {})
  }

  // Ново известување: оптимистички локално + (ако сме најавени) во базата +
  // телефонска локална нотификација (не за админ — таму не е потребно).
  function pushNotification({ title, body }) {
    const optimistic = { id: `local-${Date.now()}`, title, body, group: 'Денес', read: false, createdAt: new Date().toISOString() }
    setNotifications((prev) => [optimistic, ...prev])
    if (email) createNotificationApi({ title, body, email }).catch(() => {})
    if (auth.role !== 'admin') scheduleLocalNotification({ title, body })
  }

  // AQI > 100 → in-app известување (само ако notif_air е вклучено; без FCM/push).
  useEffect(() => {
    if (auth.role === 'admin' || !notifAir) return undefined

    let cancelled = false
    let timer = null
    const controller = new AbortController()

    async function ensureLocation() {
      if (airLocationRef.current) return airLocationRef.current
      try {
        const pos = await captureGeolocation()
        airLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      } catch { /* без GPS — fallback на референтен сензор */ }
      return airLocationRef.current
    }

    async function checkAir() {
      try {
        const sensors = await fetchAllAirSensors(controller.signal)
        if (cancelled || !sensors.length) return
        const loc = await ensureLocation()
        const sensor = pickAirAlertSensor(sensors, loc?.lat, loc?.lng)
        if (!sensor?.id || sensor.aqi == null) return

        const prev = airAlertStateRef.current.get(sensor.id) || 'ok'
        const { notify, nextState } = nextAirAlertState(prev, sensor.aqi)
        airAlertStateRef.current.set(sensor.id, nextState)
        if (!notify) return

        const name = sensor.name || sensor.area || sensor.id
        pushInAppNotification({
          title: translate(language, 'notif.airAlertTitle'),
          body: translate(language, 'notif.airAlertBody', { name, aqi: sensor.aqi }),
        })
      } catch { /* WAQI офлајн — проба повторно на следниот tick */ }
    }

    const schedule = () => { timer = setTimeout(tick, AIR_CHECK_MS) }
    async function tick() {
      if (!document.hidden) await checkAir()
      schedule()
    }
    const onVisibility = () => { if (!document.hidden) checkAir() }

    checkAir()
    schedule()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      controller.abort()
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [auth.role, notifAir, email, language, reportsIdentityKey])

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

  function deleteNotification(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (email && typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)) {
      deleteNotificationApi(id, email)
        .then((data) => {
          if (!data.removed) addHiddenNotificationId(reportsIdentityKey, id)
        })
        .catch(() => addHiddenNotificationId(reportsIdentityKey, id))
    }
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
        nearestSensorId: p.nearestSensorId || null,
        nearestSensorDistanceM: p.nearestSensorDistanceM ?? null,
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
        fill: p.fill ?? null, issue: p.containerIssue || 'full', description: p.description || '',
        photo: (p.dataUrls && p.dataUrls[0]) || '', issueOpen: true,
        reportedBy, reportedById: currentUserId, reportedByDevice: DEVICE_ID, createdAt: now,
      }, ...prev])
    }
  }

  // Пријава (миризба/депонија/контејнер) → backend (слики како BYTEA во база).
  // Успех → веднаш освежи од сервер; офлајн → оптимистички локален запис + кеш.
  async function submitReport(payload) {
    let location = payload.location || ''
    let municipality = payload.municipality || ''
    if (payload.lat != null && payload.lng != null && (!location || !municipality)) {
      const info = await resolveLocationInfo(payload.lat, payload.lng)
      if (!location) location = info.label
      if (!municipality) municipality = info.municipality
    }

    let nearestPointId = payload.nearestPointId || payload.nearestSensorId || null
    let nearestPointType = payload.nearestPointType || (payload.nearestSensorId ? 'air_sensor' : null)
    let nearestDistanceM = payload.nearestDistanceM ?? payload.nearestSensorDistanceM ?? null

    if (payload.type === 'smell' && payload.lat != null && payload.lng != null) {
      try {
        const sensors = await fetchAllAirSensors()
        const found = findNearestSensor(payload.lat, payload.lng, sensors)
        if (found) {
          nearestPointId = found.sensor.id
          nearestPointType = 'air_sensor'
          nearestDistanceM = found.distanceM
        }
      } catch { /* без најблизок сензор */ }
    } else if (payload.type === 'container' && payload.lat != null && payload.lng != null) {
      const found = findNearestContainerPoint(payload.lat, payload.lng)
      if (found) {
        nearestPointId = found.id
        nearestPointType = found.type
        nearestDistanceM = found.distanceM
      }
    }

    const backendPayload = {
      type: payload.type,
      reporterId: auth.isAnonymous ? null : (auth.userId || undefined),
      deviceId: DEVICE_ID,
      reporterEmail: auth.email || null,
      reporterName: auth.email || null,
      location,
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
      nearestPointId,
      nearestPointType,
      nearestDistanceM,
    }
    try {
      const created = await persistReportWithPhotos(backendPayload)
      mergeReportFromServer(created)
      refreshData()
      // Потврда по успешна пријава: in-app + телефонска нотификација (како депонија).
      if (payload.type === 'waste') {
        pushNotification({
          title: t('deponija.newReportTitle'),
          body: t('deponija.newReportBody', { loc: payload.location || t('admin.unknownLocation') }),
        })
      } else if (payload.type === 'container') {
        pushNotification({
          title: t('container.newReportTitle'),
          body: t('container.newReportBody', { loc: payload.location || t('admin.unknownLocation') }),
        })
      }
      return { ok: true }
    } catch {
      optimisticInsertReport(payload)
      // И офлајн: корисникот добива потврда дека пријавата е зачувана локално.
      if (payload.type === 'waste') {
        pushNotification({
          title: t('deponija.newReportTitle'),
          body: t('deponija.newReportBody', { loc: payload.location || t('admin.unknownLocation') }),
        })
      } else if (payload.type === 'container') {
        pushNotification({
          title: t('container.newReportTitle'),
          body: t('container.newReportBody', { loc: payload.location || t('admin.unknownLocation') }),
        })
      }
      return { ok: true, offline: true }
    }
  }

  // Промена на статус/решавање на пријава (админ/надлежен) → PATCH кон backend.
  async function changeReportStatus(id, status, extra = {}) {
    try {
      const row = await updateReportStatus(id, status, extra)
      mergeReportFromServer(row)
      refreshReports()
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
    setAuth({
      isAuthenticated: true,
      role: user.role || 'user',
      email: user.email || e,
      displayName: user.displayName || '',
      userId: user.id || '',
      isAnonymous: false,
    })
    if (user.language && isSupportedLanguage(user.language)) setLanguage(user.language)
    return user
  }

  async function register({ email: e, password, displayName }) {
    const user = await registerApi({ email: e, password, displayName, language })
    setAuth({
      isAuthenticated: true,
      role: user.role || 'user',
      email: user.email || e,
      displayName: user.displayName || displayName || '',
      userId: user.id || '',
      isAnonymous: false,
    })
    return user
  }

  // ---- Настани (заедница) ----

  async function createEvent(payload) {
    await createEventApi({ ...payload, organizerEmail: email, organizerName: payload.organizerName || email })
    refreshEvents()
  }
  async function joinEvent(id, payload = {}) {
    await signupEventApi(id, { email, ...payload })
    refreshEvents()
  }
  async function leaveEvent(id) {
    if (!email) return
    await leaveEventApi(id, email)
    refreshEvents()
    refreshData()
  }
  async function deleteEvent(id) {
    await deleteEventApi(id, email)
    refreshEvents()
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
    ? (myServerPoints != null
      ? myServerPoints
      : (serverLeaderboard.find((e) => e.userId === email)?.points || 0))
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
      deleteNotification,
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
      notifAir,
      setNotifAir,
      t,
      refreshData,
      refreshEvents,
      refreshReports,
      logout,
      submitReport,
      changeReportStatus,
      login,
      register,
      createEvent,
      joinEvent,
      leaveEvent,
      deleteEvent,
    }),
    [auth, sensors, smellAlerts, wasteReports, containers, events, notifications, unreadCount, pointsLedger, currentUserId, currentUserPoints, leaderboardMonthly, apiOnline, language, notifAir, t, refreshEvents, refreshReports],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider')
  return context
}
