import crypto from 'node:crypto'
import { Router } from 'express'
import { fetchOsmContainers } from '../lib/osmContainers.js'

export const containersRouter = Router()

// ============================================================================
// Јавни точки за отпад (OSM Overpass) — позадинско освежување.
// Точките на мапата ретко се менуваат, а Overpass е бавен (10-90s) и строго
// рате-лимитиран → серверот држи снимка во меморија и ја освежува на 6 часа.
// Клиентот секогаш добива инстант одговор од меморија.
// ============================================================================

const REFRESH_MS = 6 * 60 * 60 * 1000
let snapshot = null   // { body, etag, at }
let refreshing = null

async function refresh() {
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const data = await fetchOsmContainers()
      const body = JSON.stringify(data)
      const etag = 'W/"' + crypto.createHash('sha1').update(body).digest('base64') + '"'
      snapshot = { body, etag, at: Date.now() }
    } catch {
      /* задржи ја последната успешна снимка; Overpass е често привремено зафатен */
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

refresh()
const timer = setInterval(refresh, REFRESH_MS)
if (typeof timer.unref === 'function') timer.unref()

// GET /api/containers/points → сите јавни точки (рециклирање, корпи, контејнери).
containersRouter.get('/points', async (req, res, next) => {
  try {
    if (!snapshot) await refresh()          // прв повик пред снимката да е готова
    // Serverless: тајмерот не работи меѓу повици → освежи во позадина ако е старо.
    else if (Date.now() - snapshot.at > REFRESH_MS) refresh()
    if (!snapshot) return res.json([])      // Overpass сè уште недостапен → frontend fallback
    res.setHeader('ETag', snapshot.etag)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    if (req.headers['if-none-match'] === snapshot.etag) return res.status(304).end()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.status(200).send(snapshot.body)
  } catch (err) { next(err) }
})
