import { findNearestAirSensor } from './geo'

export const AIR_ALERT_THRESHOLD = 100
export const AIR_CHECK_MS = 3 * 60 * 1000

/** Извести само при премин од AQI ≤100 → AQI >100 (без спам на секој poll). */
export function nextAirAlertState(prevState, aqi) {
  const high = aqi != null && aqi > AIR_ALERT_THRESHOLD
  if (high && prevState !== 'alert') return { notify: true, nextState: 'alert' }
  if (!high && prevState === 'alert') return { notify: false, nextState: 'ok' }
  return { notify: false, nextState: prevState || 'ok' }
}

/** Најблизок сензор до GPS; без GPS — највисок AQI меѓу референтните МЖСПП. */
export function pickAirAlertSensor(sensors, lat, lng) {
  if (!sensors?.length) return null
  if (lat != null && lng != null) {
    const found = findNearestAirSensor(lat, lng, sensors)
    if (found?.sensor) return found.sensor
  }
  const referent = sensors.filter((s) => s?.aqi != null && s.category === 'referent')
  if (!referent.length) return null
  return referent.reduce((best, s) => (s.aqi > (best?.aqi ?? -1) ? s : best), null)
}
