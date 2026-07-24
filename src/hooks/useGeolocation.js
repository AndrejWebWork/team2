import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveLocationLabel } from '../lib/geo'
import { captureGeolocation, geoErrorMessage, isLikelyDesktop } from '../lib/geolocation'

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
  useEffect(() => { locRef.current = loc }, [loc])

  const applyPosition = useCallback(async (pos) => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords
    const label = await resolveLocationLabel(lat, lng)
    const next = {
      lat,
      lng,
      label,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      loading: false,
      error: '',
      denied: false,
      isDesktop: isLikelyDesktop(),
    }
    setLoc(next)
    locRef.current = next
    return next
  }, [])

  const request = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    setLoc((l) => ({ ...l, loading: true, error: '', isDesktop: isLikelyDesktop() }))
    try {
      const pos = await captureGeolocation()
      await applyPosition(pos)
    } catch (err) {
      const denied = err?.code === 1
      setLoc({
        lat: null,
        lng: null,
        label: '',
        accuracy: null,
        loading: false,
        denied,
        error: geoErrorMessage(err, t),
        isDesktop: isLikelyDesktop(),
      })
    } finally {
      busyRef.current = false
    }
  }, [applyPosition, t])

  /** Пред submit — свежо мерење (особено на desktop). Враќа { lat, lng, label } или null. */
  const ensureFresh = useCallback(async () => {
    if (busyRef.current) {
      const cur = locRef.current
      return cur.lat != null ? { lat: cur.lat, lng: cur.lng, label: cur.label } : null
    }
    busyRef.current = true
    setLoc((l) => ({ ...l, loading: true, error: '' }))
    try {
      const pos = await captureGeolocation()
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

  useEffect(() => {
    request()
  }, [request])

  return { ...loc, retry: request, ensureFresh }
}
