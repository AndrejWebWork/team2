import { Capacitor, registerPlugin } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

/** Custom iOS CoreLocation plugin (see ios/App/App/EkoLocationPlugin.swift). */
const EkoLocation = registerPlugin('EkoLocation')

/** Desktop/web прелистувач (не native app) — GPS е помалку точен (Wi‑Fi/IP). */
export function isLikelyDesktop() {
  if (typeof window === 'undefined') return false
  if (Capacitor.isNativePlatform()) return false
  return window.matchMedia('(pointer: fine)').matches || window.innerWidth >= 768
}

function mapGeoError(err) {
  if (err?.code === 1 || err?.code === 'denied') return { denied: true, key: 'gps.denied' }
  const msg = String(err?.message || err || '').toLowerCase()
  const code = String(err?.code || '')
  if (
    code === 'denied'
    || code === 'services_off'
    || code === 'OS-PLUG-GLOC-0003'
    || code === 'OS-PLUG-GLOC-0007'
    || msg === 'location permission denied.'
    || msg.includes('permission denied')
    || msg.includes('location services are not enabled')
  ) {
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

function isDenied(err) {
  if (err?.code === 1 || err?.iosLocationOff) return true
  const mapped = mapGeoError(err)
  return mapped.denied
}

/** iOS: само EkoLocation (plain CLLocationManager) — не го користиме ION plugin-от. */
async function getIosPosition(options) {
  let perm
  try {
    perm = await EkoLocation.checkPermissions()
  } catch (err) {
    const code = String(err?.code || '')
    if (code === 'services_off') {
      throw Object.assign(new Error('services_off'), { code: 1, iosLocationOff: true })
    }
    throw err
  }

  if (perm.location !== 'granted') {
    try {
      perm = await EkoLocation.requestPermissions()
    } catch (err) {
      const code = String(err?.code || '')
      if (code === 'services_off') {
        throw Object.assign(new Error('services_off'), { code: 1, iosLocationOff: true })
      }
      throw err
    }
  }
  if (perm.location === 'denied') {
    throw Object.assign(new Error('denied'), { code: 1 })
  }

  const tries = [
    { enableHighAccuracy: true, timeout: 40000, maximumAge: 0 },
    { enableHighAccuracy: true, timeout: 35000, maximumAge: options.maximumAge ?? 8000 },
  ]

  let lastErr = null
  for (const opts of tries) {
    try {
      const pos = await EkoLocation.getCurrentPosition(opts)
      return normalizePosition(pos)
    } catch (err) {
      lastErr = err
      if (isDenied(err)) {
        throw Object.assign(new Error('denied'), {
          code: 1,
          iosLocationOff: String(err?.code || '') === 'services_off',
        })
      }
    }
  }
  throw lastErr || Object.assign(new Error('failed'), { code: 2 })
}

/** Android: Capacitor Geolocation. */
async function getAndroidPosition(options) {
  let perm
  try {
    perm = await Geolocation.checkPermissions()
  } catch (err) {
    throw err
  }

  if (perm.location !== 'granted' && perm.location !== 'limited') {
    perm = await Geolocation.requestPermissions()
  }
  if (perm.location === 'denied') {
    throw Object.assign(new Error('denied'), { code: 1 })
  }

  return watchBestNative({
    enableHighAccuracy: true,
    timeout: options.timeout ?? 20000,
    maximumAge: options.maximumAge ?? 0,
  })
}

const GOOD_ACCURACY_M = 20
const WATCH_MS = 10000

async function watchBestNative(options) {
  return new Promise((resolve, reject) => {
    let best = null
    let watchId = null
    let settled = false

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
      if (best) finish(() => resolve(normalizePosition(best)))
      else {
        Geolocation.getCurrentPosition(options)
          .then((pos) => finish(() => resolve(normalizePosition(pos))))
          .catch((err) => finish(() => reject(err)))
      }
    }, WATCH_MS)

    Geolocation.watchPosition(options, (pos, err) => {
      if (err || !pos?.coords) return
      if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos
      if (pos.coords.accuracy > 0 && pos.coords.accuracy <= GOOD_ACCURACY_M) {
        finish(() => resolve(normalizePosition(best)))
      }
    }).then((id) => {
      watchId = id
    }).catch((err) => {
      finish(() => reject(err))
    })
  })
}

async function getNativePosition(options) {
  if (Capacitor.getPlatform() === 'ios') {
    return getIosPosition(options)
  }
  return getAndroidPosition(options)
}

/**
 * Телефон: GPS, watch ~10s, најточно мерење, рано стоп ≤ 20 m.
 * Компјутер: мрежна/Wi‑Fi локација (нема GPS), watch ~12s, рано стоп ≤ 150 m.
 */
export function captureGeolocation({
  desktop = isLikelyDesktop(),
  maximumAge,
  timeout,
} = {}) {
  if (Capacitor.isNativePlatform()) {
    return getNativePosition({
      enableHighAccuracy: true,
      maximumAge: maximumAge ?? 0,
      timeout: timeout ?? 30000,
    })
  }

  if (!navigator.geolocation) {
    return Promise.reject(Object.assign(new Error('NOT_SUPPORTED'), { key: 'gps.notSupported' }))
  }

  // Прво едно барање — веднаш го отвора прозорецот „Дозволи локација“.
  // Watch доаѓа само откако има фикс, за да не се чека тивко ако GPS е исклучен.
  return getWebCurrentPosition({
    enableHighAccuracy: !desktop,
    maximumAge: maximumAge ?? 0,
    timeout: timeout ?? (desktop ? 12000 : 15000),
  }).then((pos) => {
    const goodAcc = desktop ? 150 : GOOD_ACCURACY_M
    if (pos.coords.accuracy > 0 && pos.coords.accuracy <= goodAcc) return normalizePosition(pos)
    return refineWebPosition(pos, { desktop, goodAcc })
  }).catch((err) => {
    const code = err?.code
    if (code === 1) {
      throw Object.assign(new Error('denied'), { code: 1, key: 'gps.webDenied' })
    }
    if (code === 2) {
      throw Object.assign(new Error('unavailable'), { code: 2, key: 'gps.webOff', servicesOff: true })
    }
    throw Object.assign(err instanceof Error ? err : new Error('failed'), {
      code: code || 3,
      key: 'gps.webOff',
    })
  })
}

function refineWebPosition(first, { desktop, goodAcc }) {
  return new Promise((resolve) => {
    let best = first
    const options = {
      enableHighAccuracy: !desktop,
      maximumAge: 0,
      timeout: 8000,
    }
    let settled = false
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos
        if (pos.coords.accuracy > 0 && pos.coords.accuracy <= goodAcc) done()
      },
      () => done(),
      options,
    )
    const timer = setTimeout(done, desktop ? 8000 : WATCH_MS)
    function done() {
      if (settled) return
      settled = true
      clearTimeout(timer)
      navigator.geolocation.clearWatch(watchId)
      resolve(normalizePosition(best))
    }
  })
}

export async function captureGeolocationWithRetries({
  attempts = 3,
  delayMs = 1200,
} = {}) {
  let lastErr = null
  for (let i = 0; i < attempts; i++) {
    try {
      return await captureGeolocation({
        maximumAge: 0,
        timeout: Capacitor.getPlatform() === 'ios' ? 40000 : 20000,
      })
    } catch (err) {
      lastErr = err
      if (!Capacitor.isNativePlatform() && (isDenied(err) || err?.code === 2 || err?.key === 'gps.webOff' || err?.key === 'gps.webDenied')) {
        throw err
      }
      if (isDenied(err)) {
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

export async function openNativeLocationSettings({ denied = false, servicesOff = false } = {}) {
  if (!Capacitor.isNativePlatform()) return false
  const platform = Capacitor.getPlatform()

  if (platform === 'ios') {
    if (servicesOff) {
      try {
        const { NativeSettings, IOSSettings } = await import('capacitor-native-settings')
        await NativeSettings.openIOS({ option: IOSSettings.LocationServices })
        return true
      } catch { /* */ }
    }

    try {
      const { NativeSettings, IOSSettings } = await import('capacitor-native-settings')
      const res = await NativeSettings.openIOS({ option: IOSSettings.App })
      if (res?.status !== false && res?.success !== false) return true
    } catch { /* */ }

    try {
      const { App } = await import('@capacitor/app')
      await App.openUrl({ url: 'app-settings:' })
      return true
    } catch { /* */ }

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
  if (err?.key && !Capacitor.isNativePlatform()) return t(err.key)
  if (err?.key === 'gps.notSupported') return t(err.key)
  const mapped = mapGeoError(err)
  if (Capacitor.isNativePlatform() && mapped.denied) return t('gps.deniedNative')
  if (!Capacitor.isNativePlatform()) {
    if (mapped.denied || err?.code === 1) return t('gps.webDenied')
    return t('gps.webOff')
  }
  return t(mapped.denied ? 'gps.denied' : 'gps.failed')
}

export function formatAccuracyMeters(accuracy, t) {
  if (accuracy == null || !Number.isFinite(accuracy)) return null
  const m = Math.round(accuracy)
  return t('gps.accuracyApprox', { m })
}
