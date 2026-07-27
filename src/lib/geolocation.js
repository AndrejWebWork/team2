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

/** Capacitor GPS на Android/iOS — поточен и со правилни дозволи. */
async function getNativePosition(options) {
  const platform = Capacitor.getPlatform()
  let perm = await Geolocation.checkPermissions()
  // На iOS: prompt → барај дозвола; denied → фрли за да се отворат Settings.
  if (perm.location !== 'granted' && perm.location !== 'limited') {
    perm = await Geolocation.requestPermissions()
  }
  if (perm.location === 'denied') {
    throw Object.assign(new Error('denied'), { code: 1 })
  }

  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? (platform === 'ios' ? 20000 : 10000),
      maximumAge: options.maximumAge ?? 120000,
    })
    return {
      coords: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      },
      timestamp: pos.timestamp,
    }
  } catch (err) {
    // iOS често враќа грешка кога Location Services се исклучени.
    const msg = String(err?.message || err || '').toLowerCase()
    if (platform === 'ios' && (msg.includes('denied') || msg.includes('disabled') || msg.includes('kclerror'))) {
      throw Object.assign(new Error('denied'), { code: 1, iosLocationOff: true })
    }
    throw err
  }
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
      timeout: timeout ?? 10000,
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
  delayMs = 1200,
} = {}) {
  let lastErr = null
  for (let i = 0; i < attempts; i++) {
    try {
      return await captureGeolocation({
        maximumAge: i === 0 ? 120000 : 0,
        timeout: 10000,
      })
    } catch (err) {
      lastErr = err
      // Ако е трајно одбиена дозвола — нема смисла да се обидуваме уште 2 пати.
      if (err?.code === 1 && i === 0) {
        // Уште еден обид по кратка пауза (корисникот може да кликне Allow).
        await sleep(delayMs)
        try {
          return await captureGeolocation({ maximumAge: 0, timeout: 10000 })
        } catch (err2) {
          throw err2
        }
      }
      if (i < attempts - 1) await sleep(delayMs)
    }
  }
  throw lastErr || Object.assign(new Error('failed'), { code: 2 })
}

/**
 * Отвори Settings за локација.
 *
 * iOS: секогаш App Settings (единствениот официјален URL) — таму се менува
 * Location за EkoSkopje. Неофицијалните App-prefs: линкови често не работат.
 * Android: ApplicationDetails (denied) или Location (GPS).
 */
export async function openNativeLocationSettings({ denied = false } = {}) {
  if (!Capacitor.isNativePlatform()) return false
  const platform = Capacitor.getPlatform()

  if (platform === 'ios') {
    // 1) capacitor-native-settings → App Settings
    try {
      const { NativeSettings, IOSSettings } = await import('capacitor-native-settings')
      const res = await NativeSettings.openIOS({ option: IOSSettings.App })
      if (res?.status !== false && res?.success !== false) return true
    } catch { /* пробај следен fallback */ }

    // 2) Capacitor App.openUrl
    try {
      const { App } = await import('@capacitor/app')
      await App.openUrl({ url: 'app-settings:' })
      return true
    } catch { /* пробај следен fallback */ }

    // 3) Директно во WebView (работи на повеќето Capacitor iOS билдови)
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
