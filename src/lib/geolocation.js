import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

/** Desktop/web прелистувач (не native app) — GPS е помалку точен (Wi‑Fi/IP). */
export function isLikelyDesktop() {
  if (typeof window === 'undefined') return false
  if (Capacitor.isNativePlatform()) return false
  return window.matchMedia('(pointer: fine)').matches || window.innerWidth >= 768
}

function mapGeoError(err) {
  if (err?.code === 1) return { denied: true, key: 'gps.denied' }
  const msg = String(err?.message || err || '').toLowerCase()
  if (msg.includes('denied') || msg.includes('permission')) {
    return { denied: true, key: 'gps.denied' }
  }
  return { denied: false, key: 'gps.failed' }
}

function getWebCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function normalizePosition(pos) {
  return {
    coords: {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    },
    timestamp: pos.timestamp,
  }
}

function isPermissionDeniedError(err) {
  if (err?.code === 1 || err?.iosLocationOff) return true
  const msg = String(err?.message || err || '').toLowerCase()
  const code = String(err?.code || '')
  return (
    msg.includes('denied')
    || msg.includes('permission')
    || msg.includes('disabled')
    || msg.includes('location services')
    || code === '3'
    || code === 'OS-PLUG-GLOC-0003'
    || code === 'OS-PLUG-GLOC-0007'
  )
}

/** Еден обид преку Capacitor Geolocation. */
async function tryCapacitorPosition({
  enableHighAccuracy,
  timeout,
  maximumAge,
}) {
  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy,
    timeout,
    maximumAge,
  })
  return normalizePosition(pos)
}

/** watchPosition често успева на iOS кога getCurrentPosition timeout-ува. */
function tryCapacitorWatch({ enableHighAccuracy, timeout }) {
  return new Promise((resolve, reject) => {
    let settled = false
    let watchId = null
    const finish = (fn) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (watchId != null) {
        Geolocation.clearWatch({ id: watchId }).catch(() => {})
      }
      fn()
    }
    const timer = setTimeout(() => {
      finish(() => reject(Object.assign(new Error('timeout'), { code: 2 })))
    }, timeout)

    Geolocation.watchPosition(
      { enableHighAccuracy, timeout },
      (pos, err) => {
        if (err) {
          finish(() => reject(err))
          return
        }
        if (pos?.coords) finish(() => resolve(normalizePosition(pos)))
      },
    ).then((id) => {
      watchId = id
    }).catch((err) => {
      finish(() => reject(err))
    })
  })
}

/** Capacitor GPS на Android/iOS — поточен и со правилни дозволи. */
async function getNativePosition(options) {
  const platform = Capacitor.getPlatform()
  const isIos = platform === 'ios'

  let perm
  try {
    perm = await Geolocation.checkPermissions()
  } catch (err) {
    const msg = String(err?.message || err || '').toLowerCase()
    if (msg.includes('disabled') || msg.includes('location services')) {
      throw Object.assign(new Error('services_off'), { code: 1, iosLocationOff: true })
    }
    throw err
  }

  if (perm.location !== 'granted' && perm.location !== 'limited') {
    try {
      perm = await Geolocation.requestPermissions()
    } catch (err) {
      const msg = String(err?.message || err || '').toLowerCase()
      if (msg.includes('disabled') || msg.includes('location services')) {
        throw Object.assign(new Error('services_off'), { code: 1, iosLocationOff: true })
      }
      throw err
    }
  }
  if (perm.location === 'denied') {
    throw Object.assign(new Error('denied'), { code: 1 })
  }

  const maxAge = options.maximumAge ?? (isIos ? 120000 : 0)
  const attempts = isIos
    ? [
        // 1) Брз Wi‑Fi/cell fix (дозволата е OK — не чекај GPS сателити).
        { enableHighAccuracy: false, timeout: 20000, maximumAge: Math.max(maxAge, 120000) },
        // 2) Висока точност со подолг timeout.
        { enableHighAccuracy: true, timeout: 45000, maximumAge: maxAge },
        // 3) watchPosition fallback.
        { watch: true, enableHighAccuracy: false, timeout: 25000 },
        { watch: true, enableHighAccuracy: true, timeout: 35000 },
      ]
    : [
        {
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: options.timeout ?? 10000,
          maximumAge: maxAge,
        },
      ]

  let lastErr = null
  for (const attempt of attempts) {
    try {
      if (attempt.watch) {
        return await tryCapacitorWatch(attempt)
      }
      return await tryCapacitorPosition(attempt)
    } catch (err) {
      lastErr = err
      if (isPermissionDeniedError(err)) {
        const msg = String(err?.message || err || '').toLowerCase()
        throw Object.assign(new Error('denied'), {
          code: 1,
          iosLocationOff: msg.includes('disabled') || msg.includes('location services'),
        })
      }
    }
  }

  // Последен обид: WKWebView navigator.geolocation (понекогаш работи кога plugin-от timeout-ува).
  if (isIos && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await getWebCurrentPosition({
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 120000,
      })
      return normalizePosition(pos)
    } catch (err) {
      lastErr = err
    }
  }

  if (lastErr && isPermissionDeniedError(lastErr)) {
    throw Object.assign(new Error('denied'), { code: 1 })
  }
  throw lastErr || Object.assign(new Error('failed'), { code: 2 })
}

/**
 * На desktop: watchPosition ~12s и го задржува најточното мерење.
 * На Android/iOS: Capacitor Geolocation plugin.
 * На мобилен web: едно getCurrentPosition.
 */
export function captureGeolocation({
  desktop = isLikelyDesktop(),
  maximumAge,
  timeout,
} = {}) {
  if (Capacitor.isNativePlatform()) {
    return getNativePosition({
      enableHighAccuracy: true,
      maximumAge: maximumAge ?? 120000,
      timeout: timeout ?? (Capacitor.getPlatform() === 'ios' ? 30000 : 10000),
    })
  }

  if (!navigator.geolocation) {
    return Promise.reject(Object.assign(new Error('NOT_SUPPORTED'), { key: 'gps.notSupported' }))
  }

  const options = {
    enableHighAccuracy: true,
    maximumAge: maximumAge ?? (desktop ? 0 : 30000),
    timeout: timeout ?? (desktop ? 25000 : 12000),
  }

  if (!desktop) {
    return getWebCurrentPosition(options)
  }

  return new Promise((resolve, reject) => {
    let best = null
    let watchId = null
    let settled = false

    const finish = (fn) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      fn()
    }

    const timer = setTimeout(() => {
      if (best) finish(() => resolve(best))
      else {
        getWebCurrentPosition(options)
          .then((pos) => finish(() => resolve(pos)))
          .catch((err) => finish(() => reject(err)))
      }
    }, 12000)

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos
        if (pos.coords.accuracy <= 80) finish(() => resolve(best))
      },
      () => {
        getWebCurrentPosition(options)
          .then((pos) => finish(() => resolve(pos)))
          .catch((err) => finish(() => reject(err)))
      },
      options,
    )
  })
}

/**
 * До 3 обиди за локација (ако GPS е исклучен / уредот доцни).
 * Првиот обид може да користи кеш; следните бараат посвежо мерење.
 */
export async function captureGeolocationWithRetries({
  attempts = 3,
  delayMs = 1500,
} = {}) {
  let lastErr = null
  for (let i = 0; i < attempts; i++) {
    try {
      return await captureGeolocation({
        maximumAge: i === 0 ? 180000 : 0,
        timeout: Capacitor.getPlatform() === 'ios' ? 45000 : 12000,
      })
    } catch (err) {
      lastErr = err
      if (err?.code === 1) {
        if (i === 0) {
          await sleep(delayMs)
          try {
            return await captureGeolocation({ maximumAge: 60000, timeout: 30000 })
          } catch (err2) {
            throw err2
          }
        }
        throw err
      }
      if (i < attempts - 1) await sleep(delayMs)
    }
  }
  throw lastErr || Object.assign(new Error('failed'), { code: 2 })
}

/**
 * Отвори Settings за локација.
 *
 * iOS: App Settings (официјално) — таму се појавува Location откако апликацијата
 * еднаш ќе ја побара дозволата. Ако Location Services се исклучени глобално,
 * пробај и Privacy → Location Services.
 */
export async function openNativeLocationSettings({ denied = false, servicesOff = false } = {}) {
  if (!Capacitor.isNativePlatform()) return false
  const platform = Capacitor.getPlatform()

  if (platform === 'ios') {
    if (servicesOff) {
      try {
        const { NativeSettings, IOSSettings } = await import('capacitor-native-settings')
        await NativeSettings.openIOS({ option: IOSSettings.LocationServices })
        return true
      } catch { /* падни на App Settings */ }
    }

    try {
      const { NativeSettings, IOSSettings } = await import('capacitor-native-settings')
      const res = await NativeSettings.openIOS({ option: IOSSettings.App })
      if (res?.status !== false && res?.success !== false) return true
    } catch { /* пробај следен fallback */ }

    try {
      const { App } = await import('@capacitor/app')
      await App.openUrl({ url: 'app-settings:' })
      return true
    } catch { /* пробај следен fallback */ }

    try {
      window.location.href = 'app-settings:'
      return true
    } catch {
      return false
    }
  }

  try {
    const { NativeSettings, AndroidSettings, IOSSettings } = await import('capacitor-native-settings')
    await NativeSettings.open({
      optionAndroid: denied ? AndroidSettings.ApplicationDetails : AndroidSettings.Location,
      optionIOS: IOSSettings.App,
    })
    return true
  } catch {
    return false
  }
}

export function geoErrorMessage(err, t) {
  if (err?.key) return t(err.key)
  const mapped = mapGeoError(err)
  if (Capacitor.isNativePlatform() && mapped.denied) return t('gps.deniedNative')
  return t(mapped.denied ? 'gps.denied' : 'gps.failed')
}

export function formatAccuracyMeters(accuracy, t) {
  if (accuracy == null || !Number.isFinite(accuracy)) return null
  const m = Math.round(accuracy)
  return t('gps.accuracyApprox', { m })
}
