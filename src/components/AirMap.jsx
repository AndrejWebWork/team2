import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl, Popup, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import maplibreWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useApp } from '../context/AppContext'

setWorkerUrl(maplibreWorker)

const SKOPJE = { lng: 21.4254, lat: 41.9981 }
const MAX_BOUNDS = [[18.75, 39.05], [25.55, 44.25]]
const CARTO_KEY_Q = (() => {
  const key = String(import.meta.env.VITE_CARTO_KEY || '').trim()
  return key ? `?key=${encodeURIComponent(key)}` : ''
})()

const BUILDINGS_3D = {
  id: 'building-3d',
  type: 'fill-extrusion',
  source: 'openmaptiles',
  'source-layer': 'building',
  minzoom: 13,
  filter: ['!=', ['get', 'hide_3d'], true],
  paint: {
    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
    'fill-extrusion-color': [
      'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 12],
      0, '#efe8dc',
      12, '#ddd4c4',
      28, '#c9bfae',
      55, '#b3a896',
    ],
    'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
    'fill-extrusion-opacity': 0.94,
    'fill-extrusion-vertical-gradient': true,
  },
}

function makeStyle(kind) {
  const raster = kind === 'satellite'
    ? {
      id: 'base',
      type: 'raster',
      source: 'base',
      sourceDef: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '© Esri, Maxar, Earthstar Geographics',
        maxzoom: 19,
      },
    }
    : {
      id: 'base',
      type: 'raster',
      source: 'base',
      sourceDef: {
        type: 'raster',
        tiles: [
          `https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png${CARTO_KEY_Q}`,
          `https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png${CARTO_KEY_Q}`,
          `https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png${CARTO_KEY_Q}`,
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap © CARTO',
        maxzoom: 20,
      },
    }
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      base: raster.sourceDef,
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        maxzoom: 14,
      },
    },
    layers: [
      { id: 'base', type: 'raster', source: 'base' },
      BUILDINGS_3D,
    ],
    light: {
      anchor: 'viewport',
      color: '#fff6e8',
      intensity: 0.45,
      position: [1.15, 210, 30],
    },
    sky: {
      'sky-color': '#9ec4e6',
      'horizon-color': '#e8eef4',
      'fog-color': '#dfe6ea',
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.35,
      'sky-horizon-blend': 0.75,
    },
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function aqiLevel(aqi) {
  const n = Number(aqi)
  if (!Number.isFinite(n)) return 'good'
  if (n >= 101) return 'unhealthy'
  if (n >= 51) return 'moderate'
  return 'good'
}

const AQI_PIN = {
  good: '#22c55e',
  moderate: '#f59e0b',
  unhealthy: '#ef4444',
}

const SENSOR_GLYPH = `
  <circle cx="16" cy="15.5" r="2.3" fill="#fff"/>
  <path d="M11.4 15.5a4.6 4.6 0 0 1 9.2 0" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M8.6 15.5a7.4 7.4 0 0 1 14.8 0" fill="none" stroke="#fff" stroke-width="1.55" stroke-linecap="round"/>
`

function pinSvg({ fill, inner, w = 30, h = 40 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 32 42" aria-hidden="true">
    <path d="M16 40.5S28 26.2 28 16.2A12 12 0 1 0 4 16.2C4 26.2 16 40.5 16 40.5z" fill="${fill}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
    ${inner}
  </svg>`
}

function aqiPinHtml(aqi) {
  const n = Number.isFinite(Number(aqi)) ? Math.round(Number(aqi)) : null
  const fill = AQI_PIN[aqiLevel(n)]
  const label = n == null ? '—' : String(n)
  const fs = n != null && n >= 100 ? 9.5 : 11
  return pinSvg({
    fill,
    inner: `<text x="16" y="19.5" text-anchor="middle" fill="#fff" font-size="${fs}" font-weight="800" font-family="system-ui,-apple-system,sans-serif">${label}</text>`,
  })
}

function civicPinHtml(aqi) {
  return pinSvg({ fill: AQI_PIN[aqiLevel(aqi)], inner: SENSOR_GLYPH, w: 22, h: 30 })
}

function sensorName(s, t) {
  return s.nameKey ? t(`sensor.st.${s.nameKey}`) : s.name
}

function aqiKey(aqi) {
  if (aqi >= 101) return 'unhealthy'
  if (aqi >= 51) return 'moderate'
  return 'good'
}

function popupHtml(s, t, kind) {
  const name = escapeHtml(sensorName(s, t))
  const source = escapeHtml(kind === 'ministry' ? t('air.referentSource') : t('air.pulseSensor'))
  const aqiLine = s.aqi != null
    ? `<p>AQI: <b>${escapeHtml(s.aqi)}</b> · ${escapeHtml(t(`aqi.${aqiKey(s.aqi)}`))}</p>`
    : ''
  const pm25 = s.pm25 != null ? `<p>PM2.5: ${escapeHtml(s.pm25)} µg/m³</p>` : (kind === 'ministry' ? `<p>PM2.5: ${s.pm25 ?? '—'} µg/m³</p>` : '')
  const pm10 = s.pm10 != null ? `<p>PM10: ${escapeHtml(s.pm10)} µg/m³</p>` : (kind === 'ministry' ? `<p>PM10: ${s.pm10 ?? '—'} µg/m³</p>` : '')
  const edu = `<p class="air-map-popup-edu">${escapeHtml(t('air.popupEdu'))}</p>`
  return `<div class="air-map-popup"><p class="air-map-popup-title">${name}</p><p class="air-map-popup-src">${source}</p>${aqiLine}${pm25}${pm10}${edu}</div>`
}

function makeMarkerEl(html, className) {
  const el = document.createElement('div')
  el.className = className
  el.innerHTML = html
  return el
}

export function AirMap({ ministrySensors, pulseSensors, userLocation }) {
  const { t } = useApp()
  const wrapRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const centeredRef = useRef(false)
  const tRef = useRef(t)
  const [mapReady, setMapReady] = useState(0)
  tRef.current = t

  useEffect(() => {
    if (!wrapRef.current || mapRef.current) return
    let cancelled = false
    let map
    let ro
    const style = makeStyle('streets')
    if (cancelled || !wrapRef.current || mapRef.current) return
    map = new MapLibreMap({
        container: wrapRef.current,
        style,
        center: [SKOPJE.lng, SKOPJE.lat],
        zoom: 15,
        pitch: 58,
        bearing: -28,
        minZoom: 6,
        maxZoom: 17,
        maxPitch: 72,
        maxBounds: MAX_BOUNDS,
        renderWorldCopies: false,
        attributionControl: { compact: true },
        cooperativeGestures: false,
        canvasContextAttributes: { antialias: true },
      })
      if (import.meta.env.DEV) window.__airMap = map
      map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
      map.addControl(new ScaleControl({ maxWidth: 90, unit: 'metric' }), 'bottom-left')
      const resize = () => map.resize()
      const onLoad = () => {
        resize()
        if (!cancelled) setMapReady((n) => n + 1)
      }
      map.on('load', onLoad)
      requestAnimationFrame(() => {
        if (!mapRef.current) return
        map.resize()
        map.jumpTo({ center: [SKOPJE.lng, SKOPJE.lat], zoom: 15.15, pitch: 58, bearing: -28 })
        if (map.loaded()) onLoad()
      })
      ro = new ResizeObserver(resize)
      ro.observe(wrapRef.current)
      mapRef.current = map
      setMapReady((n) => n + 1)
    return () => {
      cancelled = true
      ro?.disconnect()
      for (const rec of markersRef.current.values()) rec.marker.remove()
      markersRef.current.clear()
      if (map) {
        map.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation || centeredRef.current) return
    if (userLocation.lat == null || userLocation.lng == null) return
    const { lat, lng } = userLocation
    if (lng < 18.75 || lng > 25.55 || lat < 39.05 || lat > 44.25) return
    const nearSkopje = (lat - SKOPJE.lat) ** 2 + (lng - SKOPJE.lng) ** 2 < 0.04
    if (!nearSkopje) return
    centeredRef.current = true
    map.easeTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 14),
      pitch: 52,
      duration: 900,
    })
  }, [userLocation, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const tNow = tRef.current
    const next = new Map()

    function upsert(id, lng, lat, elHtml, className, html, z) {
      const prev = markersRef.current.get(id)
      if (prev) {
        prev.marker.setLngLat([lng, lat])
        prev.marker.getElement().innerHTML = elHtml
        prev.marker.getPopup().setHTML(html)
        next.set(id, prev)
        return
      }
      const el = makeMarkerEl(elHtml, className)
      const marker = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .setPopup(new Popup({ offset: 18, maxWidth: '220px', className: 'air-map-popup-wrap' }).setHTML(html))
        .addTo(map)
      el.style.zIndex = String(z)
      next.set(id, { marker })
    }

    if (
      userLocation?.lat != null && userLocation?.lng != null
      && userLocation.lng >= 18.75 && userLocation.lng <= 25.55
      && userLocation.lat >= 39.05 && userLocation.lat <= 44.25
    ) {
      upsert(
        'user',
        userLocation.lng,
        userLocation.lat,
        `<span class="air-map-user-dot" title="${escapeHtml(tNow('air.yourLocation'))}"></span>`,
        'air-map-user',
        `<p class="air-map-popup-title">${escapeHtml(tNow('air.yourLocation'))}</p>`,
        500,
      )
    }

    for (const s of ministrySensors || []) {
      const lat = Number(s.lat)
      const lng = Number(s.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      upsert(s.id, lng, lat, aqiPinHtml(s.aqi), 'air-map-pin', popupHtml(s, tNow, 'ministry'), 400)
    }
    for (const s of pulseSensors || []) {
      const lat = Number(s.lat)
      const lng = Number(s.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      upsert(s.id, lng, lat, civicPinHtml(s.aqi), 'air-map-pin air-map-pin-civic', popupHtml(s, tNow, 'pulse'), 200)
    }

    for (const [id, rec] of markersRef.current) {
      if (!next.has(id)) rec.marker.remove()
    }
    markersRef.current = next
  }, [ministrySensors, pulseSensors, userLocation, mapReady])

  function setStyle(kind) {
    const map = mapRef.current
    if (!map) return
    map.setStyle(makeStyle(kind))
    map.once('style.load', () => {
      for (const rec of markersRef.current.values()) rec.marker.remove()
      markersRef.current.clear()
      setMapReady((n) => n + 1)
      if (map.getZoom() >= 14 && map.getPitch() < 30) {
        map.easeTo({ pitch: 58, duration: 400 })
      }
    })
  }

  return (
    <div className='air-map-root'>
      <div ref={wrapRef} className='air-map-canvas' />
      <div className='air-map-styles'>
        <button type='button' onClick={() => setStyle('streets')}>{t('map.streets')}</button>
        <button type='button' onClick={() => setStyle('satellite')}>{t('map.satellite')}</button>
      </div>
      <p className='air-map-hint'>{t('air.map3dHint')}</p>
    </div>
  )
}
