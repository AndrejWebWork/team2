import { LayerGroup, LayersControl, TileLayer } from 'react-leaflet'
import { useApp } from '../context/AppContext'

// Заеднички слоеви за сите мапи во апликацијата.
//  * „Мапа" — CARTO Voyager: детална урбана карта (улици, згради, паркови,
//    ознаки) со retina поддршка ({r}) — многу почитлива за Скопје од light_all.
//  * „Сателит" — Esri World Imagery + CARTO ознаки (имиња на улици/населби)
//    како overlay, за да не биде сателитот „нем".
export function MapLayers() {
  const { t } = useApp()
  return (
    <LayersControl position='topright'>
      <LayersControl.BaseLayer checked name={t('map.streets')}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url='https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
          maxZoom={20}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name={t('map.satellite')}>
        <LayerGroup>
          <TileLayer
            attribution='&copy; Esri, Maxar, Earthstar Geographics'
            url='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            maxZoom={19}
          />
          <TileLayer
            url='https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png'
            maxZoom={19}
          />
        </LayerGroup>
      </LayersControl.BaseLayer>
    </LayersControl>
  )
}
