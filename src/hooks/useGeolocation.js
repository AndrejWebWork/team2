import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveLocationLabel } from '../lib/geo'
import {
  captureGeolocation,
  captureGeolocationWithRetries,
  geoErrorMessage,
  isLikelyDesktop,
  openNativeLocationSettings,
} from '../lib/geolocation'

export function useGeolocation(t) {
  const [loc, setLoc] = useState({
    lat: null,
    lng: null,
    label: '',
    accuracy: null,
    loading: true,
    error: '',
    denied: false,
    isDesktop: isLikelyDesktop(),
  })
  const busyRef = useRef(false)
  const locRef = useRef(loc)
  const pendingSettingsRetry = useRef(false)
  useEffect(() => { locRef.current = loc }, [loc])

  const applyPosition = useCallback(async (pos) => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords
    // Брзо прикажи координати; етикетата (Nominatim) во позадина.
    const quick = {
      lat,
      lng,
      label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      loading: false,
      error: '',
      denied: false,
      isDesktop: isLikelyDesktop(),
    }
    setLoc(quick)
    locRef.current = quick
    resolveLocationLabel(lat, lng).then((label) => {
      if (!label) return
      setLoc((prev) => {
        if (prev.lat !== lat || prev.lng !== lng) return prev
        const next = { ...prev, label }
        locRef.current = next
        return next
      })
    }).catch(() => {})
    return quick
  }, [])

  const request = useCallback(async ({ attempts = 1 } = {}) => {
    if (busyRef.current) return
    busyRef.current = true
    setLoc((l) => ({ ...l, loading: true, error: '', isDesktop: isLikelyDesktop() }))
    try {
      const pos = attempts > 1
        ? await captureGeolocationWithRetries({ attempts })
        : await captureGeolocation({ maximumAge: 0 })
      await applyPosition(pos)
    } catch (err) {
      const denied = err?.code === 1
      const next = {
        lat: null,
        lng: null,
        label: '',
        accuracy: null,
        loading: false,
        denied,
        error: geoErrorMessage(err, t),
        isDesktop: isLikelyDesktop(),
      }
      setLoc(next)
      locRef.current = next
    } finally {
      busyRef.current = false
    }
  }, [applyPosition, t])

  /** Побарај повторно — на native (кога нема локација) отвора settings, па пробува по враќање. */
  const retry = useCallback(async () => {
    const cur = locRef.current
    const needsSettings = Capacitor.isNativePlatform()
      && (cur.denied || cur.lat == null || Boolean(cur.error))
    if (needsSettings) {
      pendingSettingsRetry.current = true
      await openNativeLocationSettings({ denied: Boolean(cur.denied) })
    }
    await request({ attempts: 3 })
  }, [request])

  /** Освежи локација без да се отвораат settings (кога веќе имаме GPS). */
  const refresh = useCallback(async () => {
    await request({ attempts: 1 })
  }, [request])

  /** Пред submit — свежо мерење. Враќа { lat, lng, label } или null. */
  const ensureFresh = useCallback(async () => {
    if (busyRef.current) {
      const cur = locRef.current
      return cur.lat != null ? { lat: cur.lat, lng: cur.lng, label: cur.label } : null
    }
    busyRef.current = true
    setLoc((l) => ({ ...l, loading: true, error: '' }))
    try {
      const pos = await captureGeolocation({ maximumAge: 0 })
      const next = await applyPosition(pos)
      return { lat: next.lat, lng: next.lng, label: next.label }
    } catch {
      setLoc((l) => ({ ...l, loading: false }))
      const cur = locRef.current
      return cur.lat != null ? { lat: cur.lat, lng: cur.lng, label: cur.label } : null
    } finally {
      busyRef.current = false
    }
  }, [applyPosition])

  // Старт: автоматски до 3 обиди.
  useEffect(() => {
    request({ attempts: 3 })
  }, [request])

  // По враќање од Settings → повторно барај локација.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined
    let handle
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || !pendingSettingsRetry.current) return
      pendingSettingsRetry.current = false
      request({ attempts: 3 })
    }).then((h) => { handle = h }).catch(() => {})
    return () => { handle?.remove?.() }
  }, [request])

  return { ...loc, retry, refresh, ensureFresh }
}
