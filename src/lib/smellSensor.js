import { fetchPulseSensors } from './api'
import { fetchSkopjeSensors } from './waqi'

import { haversineKm } from './geo'

/** Максимална дистанца (м) за да се смета пријавата „околу" сензорот. */
export const SMELL_SENSOR_RADIUS_M = 800

function distanceM(lat, lng, sensor) {
  return haversineKm({ lat, lng }, sensor) * 1000
}

const validSensor = (s) => s?.lat != null && s?.lng != null

/** Сите референтни + граѓански + градски сензори (за групирање на admin). */
export async function fetchAllAirSensors(signal) {
  const [waqiRes, pulseRes] = await Promise.allSettled([
    fetchSkopjeSensors(signal),
    fetchPulseSensors(signal),
  ])
  const waqi = waqiRes.status === 'fulfilled' ? waqiRes.value : []
  const pulse = pulseRes.status === 'fulfilled' ? pulseRes.value : []
  const civic = waqi.filter((s) => s.category !== 'referent' && validSensor(s))
  const referent = waqi.filter((s) => s.category === 'referent' && validSensor(s))
  return [...referent, ...civic, ...pulse.filter(validSensor)]
}

export function findNearestSensor(lat, lng, sensors, maxM = SMELL_SENSOR_RADIUS_M) {
  if (lat == null || lng == null || !sensors?.length) return null
  let best = null
  let bestDist = Infinity
  for (const s of sensors) {
    if (!validSensor(s)) continue
    const d = distanceM(lat, lng, s)
    if (d < bestDist) {
      bestDist = d
      best = s
    }
  }
  if (!best || bestDist > maxM) return null
  return { sensor: best, distanceM: Math.round(bestDist) }
}

export function sensorDisplayName(sensor) {
  if (!sensor) return ''
  return sensor.name || sensor.id || ''
}

export function resolveSmellSensor(alert, sensors) {
  if (alert.nearestSensorId) {
    const sensor = sensors.find((s) => s.id === alert.nearestSensorId)
    return {
      sensorId: alert.nearestSensorId,
      sensorName: sensorDisplayName(sensor) || alert.nearestSensorId,
      distanceM: alert.nearestSensorDistanceM ?? null,
    }
  }
  const found = findNearestSensor(alert.lat, alert.lng, sensors)
  if (found) {
    return {
      sensorId: found.sensor.id,
      sensorName: sensorDisplayName(found.sensor),
      distanceM: found.distanceM,
    }
  }
  return { sensorId: '_unknown', sensorName: null, distanceM: null }
}

export function smellAlertScore(alert) {
  return (alert.intensity || 1) * 10 + (alert.severity === 'critical' ? 20 : 0)
}

/** Групира миризбени пријави по сензор и сортира по приоритет (повеќе пријави = повисок). */
export function groupSmellsBySensor(alerts, sensors) {
  const groups = new Map()
  for (const alert of alerts) {
    const { sensorId, sensorName, distanceM } = resolveSmellSensor(alert, sensors)
    if (!groups.has(sensorId)) {
      groups.set(sensorId, { sensorId, sensorName, alerts: [], distanceM })
    }
    const g = groups.get(sensorId)
    g.alerts.push({ ...alert, _sensorDistanceM: distanceM })
    if (sensorName && !g.sensorName) g.sensorName = sensorName
  }

  return [...groups.values()]
    .map((g) => {
      const count = g.alerts.length
      const maxIntensity = Math.max(...g.alerts.map((a) => a.intensity || 1))
      const hasCritical = g.alerts.some((a) => a.severity === 'critical')
      const latestAt = g.alerts.reduce((max, a) => Math.max(max, new Date(a.createdAt || 0).getTime()), 0)
      const priorityScore =
        maxIntensity * 10 +
        count * 8 +
        (hasCritical ? 25 : 0) +
        Math.min(Math.max(count - 1, 0), 6) * 5
      g.alerts.sort(
        (a, b) =>
          smellAlertScore(b) - smellAlertScore(a) ||
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      )
      return { ...g, count, maxIntensity, hasCritical, latestAt, priorityScore }
    })
    .sort((a, b) => b.priorityScore - a.priorityScore || b.latestAt - a.latestAt)
}

export function buildSmellClusterCounts(alerts, sensors) {
  const counts = new Map()
  for (const alert of alerts) {
    const { sensorId } = resolveSmellSensor(alert, sensors)
    counts.set(sensorId, (counts.get(sensorId) || 0) + 1)
  }
  return counts
}

export function smellUrgencyWithCluster(alert, clusterCount) {
  const base = smellAlertScore(alert)
  const extra = Math.max((clusterCount || 1) - 1, 0) * 8
  return base + extra
}
