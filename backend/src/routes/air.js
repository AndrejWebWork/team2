import crypto from 'node:crypto'
import { Router } from 'express'
import { query } from '../db.js'
import { fetchPulseSensors } from '../lib/pulse.js'
import { fetchSkopjeWaqiSensors } from '../lib/waqi.js'

export const airRouter = Router()

// ============================================================================
// Нереферентни/граѓански сензори (OpenAQ, fallback Sensor.community) — снимка.
// Наместо клиентот да чека на upstream при секое барање, серверот држи СНИМКА
// во меморија и ја освежува сам на интервал. Одговорот е тогаш речиси инстант
// (се сервира од меморија, без надворешен повик во патеката на барањето).
// ============================================================================

const REFRESH_MS = 30_000   // позадинско освежување на секои 30s
let snapshot = null          // { body, etag, at }
let refreshing = null        // спречува преклопени освежувања

async function refresh() {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const data = await fetchPulseSensors()
      // Не пребришувај добра снимка со празна ([] ) кога upstream е привремено паднат.
      const prevHadData = snapshot?.body && snapshot.body !== '[]'
      if (Array.isArray(data) && data.length === 0 && prevHadData) return
      const body = JSON.stringify(data)
      const etag = 'W/"' + crypto.createHash('sha1').update(body).digest('base64') + '"'
      snapshot = { body, etag, at: Date.now() }
    } catch {
      /* задржи ја последната успешна снимка при привремен пад на upstream */
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

// Тивко освежување во позадина + прво полнење при старт на серверот.
refresh()
const timer = setInterval(refresh, REFRESH_MS)
if (typeof timer.unref === 'function') timer.unref()

// ============================================================================
// WAQI / МЖСПП — иста снимка-патерн. Capacitor билдовите немаат VITE_WAQI_TOKEN;
// токенот е само на серверот (WAQI_TOKEN / VITE_WAQI_TOKEN).
// ============================================================================

const WAQI_REFRESH_MS = 60_000
let waqiSnapshot = null
let waqiRefreshing = null

async function refreshWaqi() {
  if (waqiRefreshing) return waqiRefreshing
  waqiRefreshing = (async () => {
    try {
      const data = await fetchSkopjeWaqiSensors()
      const body = JSON.stringify(data)
      const etag = 'W/"' + crypto.createHash('sha1').update(body).digest('base64') + '"'
      waqiSnapshot = { body, etag, at: Date.now() }
    } catch {
      /* задржи последна успешна снимка */
    } finally {
      waqiRefreshing = null
    }
  })()
  return waqiRefreshing
}

refreshWaqi()
const waqiTimer = setInterval(refreshWaqi, WAQI_REFRESH_MS)
if (typeof waqiTimer.unref === 'function') waqiTimer.unref()

// GET /api/air/pulse → нереферентни (граѓански) сензори во живо (од снимка).
airRouter.get('/pulse', async (req, res, next) => {
  try {
    if (!snapshot) await refresh()           // прв повик пред снимката да е готова
    else if (Date.now() - snapshot.at > REFRESH_MS) {
      // Serverless (Vercel): тајмерите не работат меѓу повици → освежи при
      // барање. Малку застарена снимка се сервира веднаш (освежување во
      // позадина); многу стара (>2 мин) се чека за да не се служат стари мерења.
      if (Date.now() - snapshot.at > 4 * REFRESH_MS) await refresh()
      else refresh()
    }
    if (!snapshot) return res.json([])       // Pulse.eco сè уште недостапен
    res.setHeader('ETag', snapshot.etag)
    res.setHeader('Cache-Control', 'public, max-age=15')
    if (req.headers['if-none-match'] === snapshot.etag) return res.status(304).end()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.status(200).send(snapshot.body)
  } catch (err) { next(err) }
})

// GET /api/air/waqi → МЖСПП + граѓански WAQI станици (од снимка).
airRouter.get('/waqi', async (req, res, next) => {
  try {
    if (!waqiSnapshot) await refreshWaqi()
    else if (Date.now() - waqiSnapshot.at > WAQI_REFRESH_MS) {
      if (Date.now() - waqiSnapshot.at > 4 * WAQI_REFRESH_MS) await refreshWaqi()
      else refreshWaqi()
    }
    if (!waqiSnapshot) return res.json([])
    res.setHeader('ETag', waqiSnapshot.etag)
    res.setHeader('Cache-Control', 'public, max-age=20')
    if (req.headers['if-none-match'] === waqiSnapshot.etag) return res.status(304).end()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.status(200).send(waqiSnapshot.body)
  } catch (err) { next(err) }
})

// GET /api/air/city → сензори на Град Скопје (category = 'city') од базата.
// Градот имал по 1 сензор во секоја општина (10 вкупно), но мрежата не е
// активна од пред 2-3 години. Табелата `sensors` е подготвена: кога Градот ќе
// ги реактивира или ќе даде пристап, мерењата се внесуваат тука и веднаш се
// прикажуваат во апликацијата — без промени во кодот.
airRouter.get('/city', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, area, source, lat, lng, aqi, pm25, pm10, status, measured_at
       FROM sensors WHERE category = 'city' ORDER BY name`,
    )
    res.setHeader('Cache-Control', 'public, max-age=30')
    res.json(rows)
  } catch (err) { next(err) }
})
