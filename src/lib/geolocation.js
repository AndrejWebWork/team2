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

/** Capacitor GPS на Android/iOS — поточен и со правилни дозволи. */
async function getNativePosition(options) {
  let perm = await Geolocation.checkPermissions()
  if (perm.location === 'denied' || perm.location === 'prompt') {
    perm = await Geolocation.requestPermissions()
  }
  if (perm.location === 'denied') {
    throw Object.assign(new Error('denied'), { code: 1 })
  }

  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: options.enableHighAccuracy ?? true,
    timeout: options.timeout ?? 15000,
    maximumAge: options.maximumAge ?? 0,
  })

  return {
    coords: {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    },
    timestamp: pos.timestamp,
  }
}

/**
 * На desktop: watchPosition ~12s и го задржува најточното мерење.
 * На Android/iOS: Capacitor Geolocation plugin.
 * На мобилен web: едно getCurrentPosition.
 */
export function captureGeolocation({ desktop = isLikelyDesktop() } = {}) {
  if (Capacitor.isNativePlatform()) {
    return getNativePosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 })
  }

  if (!navigator.geolocation) {
    return Promise.reject(Object.assign(new Error('NOT_SUPPORTED'), { key: 'gps.notSupported' }))
  }

  const options = {
    enableHighAccuracy: true,
    maximumAge: desktop ? 0 : 30000,
    timeout: desktop ? 25000 : 12000,
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

export function geoErrorMessage(err, t) {
  if (err?.key) return t(err.key)
  const mapped = mapGeoError(err)
  return t(mapped.denied ? 'gps.denied' : 'gps.failed')
}

export function formatAccuracyMeters(accuracy, t) {
  if (accuracy == null || !Number.isFinite(accuracy)) return null
  const m = Math.round(accuracy)
  return t('gps.accuracyApprox', { m })
}
