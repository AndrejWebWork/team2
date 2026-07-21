import compression from 'compression'
import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { pool } from './db.js'
import { airRouter } from './routes/air.js'
import { authRouter } from './routes/auth.js'
import { containersRouter } from './routes/containers.js'
import { cronRouter } from './routes/cron.js'
import { devicesRouter } from './routes/devices.js'
import { eventsRouter } from './routes/events.js'
import { leaderboardRouter } from './routes/leaderboard.js'
import { notificationsRouter } from './routes/notifications.js'
import { reportsRouter } from './routes/reports.js'
import { uploadsRouter } from './routes/uploads.js'
import { usersRouter } from './routes/users.js'

const app = express()

// Не откривај дека серверот е Express (помалку информации за напаѓач).
app.disable('x-powered-by')

// Основни безбедносни заглавја (без надворешни зависности). Не влијаат на
// вчитувањето на сликите од /uploads (не поставуваме рестриктивен CORP).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-DNS-Prefetch-Control', 'off')
  // HSTS — само кога барањето е преку HTTPS (зад TLS/прокси на Acton). На чист
  // HTTP (локален развој) не се поставува за да не наштети.
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }
  next()
})

// Gzip компресија на одговорите — JSON листите (пр. 500 пријави) се смалуваат
// повеќекратно, што значи помал проток при голем број корисници.
app.use(compression())

// Лесен in-memory rate-limit фабрика (заштита од brute-force/спам, без зависности).
// Лимитите се доволно високи за да не пречат на нормални корисници.
function makeRateLimit({ windowMs, max, message }) {
  const hits = new Map()
  return function rateLimit(req, res, next) {
    const ip = req.ip || 'unknown'
    const now = Date.now()
    if (hits.size > 20000) hits.clear() // спречи неограничен раст на меморија
    const rec = hits.get(ip)
    if (!rec || now > rec.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs })
      return next()
    }
    rec.count += 1
    if (rec.count > max) {
      return res.status(429).json({ error: message || 'Премногу барања. Обидете се повторно подоцна.' })
    }
    next()
  }
}

// Најава/регистрација: строго (brute-force заштита).
const authRateLimit = makeRateLimit({ windowMs: 15 * 60 * 1000, max: 40, message: 'Премногу обиди. Обидете се повторно подоцна.' })
// Поднесување пријави: заштита од спам во базата. 20/мин по IP е повеќе од
// доволно за реален корисник (обично поднесува 1–3), а блокира ботови.
const submitRateLimit = makeRateLimit({ windowMs: 60 * 1000, max: 20, message: 'Премногу пријави во краток период. Обидете се повторно за минута.' })

const allowedOrigins = new Set(config.corsOrigin)
app.use(cors({
  origin(origin, cb) {
    // Барања без Origin (native, curl) или од дозволена листа.
    if (!origin || allowedOrigins.has(origin)) return cb(null, true)
    // Vercel deployments (production + preview) — frontend и API се на ист
    // домен, но браузерот сепак праќа Origin заглавје на POST барања.
    try {
      const host = new URL(origin).hostname
      if (host.endsWith('.vercel.app')) return cb(null, true)
    } catch { /* невалиден origin — паѓа на грешката подолу */ }
    cb(new Error(`CORS: origin ${origin} не е дозволен.`))
  },
}))
app.use(express.json({ limit: '1mb' }))

// Сликите на пријавите се чуваат во база (BYTEA) и се сервираат преку
// /api/reports/:id/photos/:n. Оваа статична папка останува само за евентуални
// стари/надворешни фајлови (не се користи за нови пријави).
app.use('/uploads', express.static(config.uploadDir, {
  maxAge: '7d',
  immutable: true,
}))

// Здравствена проверка (и на базата)
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, db: 'up' })
  } catch {
    res.status(503).json({ ok: false, db: 'down' })
  }
})

app.use('/api/auth', authRateLimit, authRouter)
app.use('/api/air', airRouter)
app.use('/api/cron', cronRouter)
app.use('/api/containers', containersRouter)
app.use('/api/devices', devicesRouter)
app.use('/api/uploads', uploadsRouter)
// Лимитирај само поднесување (POST) пријави; читањата (GET, кеширани) остануваат
// неограничени за брз пристап при голем број корисници.
app.use('/api/reports', (req, res, next) => (req.method === 'POST' ? submitRateLimit(req, res, next) : next()), reportsRouter)
app.use('/api/users', usersRouter)
app.use('/api/events', eventsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/leaderboard', leaderboardRouter)

// Централизирана обработка на грешки (вкл. multer лимити)
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
  res.status(status).json({ error: err.message || 'Внатрешна грешка.' })
})

// Апликацијата се извезува без .listen() — истата се користи и од локалниот
// сервер (server.js) и од Vercel serverless функцијата (api/index.js).
export { app }
