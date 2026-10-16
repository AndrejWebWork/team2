import { useEffect } from 'react'
import L from 'leaflet'
import { LayerGroup, LayersControl, TileLayer, useMap } from 'react-leaflet'
import { useApp } from '../context/AppContext'

// Бесплатен клуч: https://carto.com/basemaps/apikey/ → VITE_CARTO_KEY во .env
// (Vite го впекува при npm run build). Без клуч CARTO става воден жиг.
const CARTO_KEY_Q = (() => {
  const key = String(import.meta.env.VITE_CARTO_KEY || '').trim()
  return key ? `?key=${encodeURIComponent(key)}` : ''
})()

// Македонија + блиски соседи (Албанија, Косово, јужна Србија, западна Бугарија,
// северна Грција, источна Црна Гора) — не целиот свет.
export const MAP_MAX_BOUNDS = [
  [39.05, 18.75],
  [44.25, 25.55],
]

export const MAP_VIEW_LIMITS = {
  maxBounds: MAP_MAX_BOUNDS,
  maxBoundsViscosity: 1,
  minZoom: 6,
  worldCopyJump: false,
}

function MapRegionLimit() {
  const map = useMap()
  useEffect(() => {
    const bounds = L.latLngBounds(MAP_MAX_BOUNDS)
    const apply = () => {
      const fitted = map.getBoundsZoom(bounds, true)
      const minZ = Number.isFinite(fitted) ? Math.max(6, fitted) : 6
      map.setMinZoom(minZ)
      if (map.getZoom() < minZ) map.setZoom(minZ)
    }
    apply()
    map.on('resize', apply)
    return () => { map.off('resize', apply) }
  }, [map])
  return null
}

// Заеднички слоеви за сите мапи во апликацијата.
//  * „Мапа" — CARTO Voyager: детална урбана карта (улици, згради, паркови,
//    ознаки) со retina поддршка ({r}) — многу почитлива за Скопје од light_all.
//  * „Сателит" — Esri World Imagery + CARTO ознаки (имиња на улици/населби)
//    како overlay, за да не биде сателитот „нем".
export function MapLayers() {
  const { t } = useApp()
  return (
    <>
      <MapRegionLimit />
      <LayersControl position='topright'>
        <LayersControl.BaseLayer checked name={t('map.streets')}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${CARTO_KEY_Q}`}
            minZoom={6}
            maxZoom={20}
            noWrap
            detectRetina
            keepBuffer={2}
            updateWhenZooming
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name={t('map.satellite')}>
          <LayerGroup>
            <TileLayer
              attribution='&copy; Esri, Maxar, Earthstar Geographics'
              url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              minZoom={6}
              maxZoom={19}
              noWrap
              detectRetina
              keepBuffer={2}
            />
            <TileLayer
              url={`https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png${CARTO_KEY_Q}`}
              minZoom={6}
              maxZoom={19}
              noWrap
              detectRetina
            />
          </LayerGroup>
        </LayersControl.BaseLayer>
      </LayersControl>
    </>
  )
}
