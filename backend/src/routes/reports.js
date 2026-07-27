import { Router } from 'express'
import multer from 'multer'
import { config } from '../config.js'
import { query } from '../db.js'
import { sendPushToDevice, sendPushToUser } from '../lib/fcm.js'
import { invalidateCache, serveCachedJson, serveFreshJson } from '../lib/responseCache.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { resolveUserId } from '../services/users.js'

export const reportsRouter = Router()

// Јавната листа пријави е иста за сите → кеш 5s (заштита при 200k корисници).
const REPORTS_TTL_MS = 60000

// Сликите се примаат во меморија и се складираат како BYTEA во база (без диск).
const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp'])
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: config.maxPhotos },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE.has(file.mimetype)) return cb(null, true)
    cb(new Error('Дозволени се само слики (JPEG, PNG, WEBP).'))
  },
})

// Помошни коерции (multipart полињата доаѓаат како стрингови).
const str = (v) => (v == null || v === '' ? null : String(v))
const num = (v) => (v == null || v === '' ? null : Number(v))
const int = (v) => (v == null || v === '' ? null : parseInt(v, 10))

// dataURL/base64 (JSON тело) → Buffer, за да работи и без multipart.
function dataUrlToBuffer(d) {
  if (!d || typeof d !== 'string') return null
  const comma = d.indexOf(',')
  const b64 = comma >= 0 ? d.slice(comma + 1) : d
  try {
    const buf = Buffer.from(b64, 'base64')
    return buf.length ? buf : null
  } catch {
    return null
  }
}

// Ги собира бинарните слики од барањето: прво multipart фајлови, инаку base64.
function gatherPhotoBuffers(req) {
  if (Array.isArray(req.files) && req.files.length) {
    return req.files.slice(0, config.maxPhotos).map((f) => f.buffer)
  }
  const arr = Array.isArray(req.body?.photos) ? req.body.photos : []
  return arr.slice(0, config.maxPhotos).map(dataUrlToBuffer).filter(Boolean)
}

// MIME од првите бајти (magic number), за да не чуваме посебна колона за тип.
function detectMime(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return 'application/octet-stream'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif'
  return 'application/octet-stream'
}

// Доделува поени еднаш по (пријава, причина). Само за регистрирани корисници
// (анонимните немаат поени). Синхронизира и `users.points` (тековен збир).
async function awardPointsOnce(userId, points, reason, reportId) {
  if (!userId) return
  const { rowCount } = await query(
    `INSERT INTO points_events (user_id, points, reason, report_id)
     SELECT $1, $2, $3, $4
     WHERE NOT EXISTS (
       SELECT 1 FROM points_events WHERE report_id = $4 AND reason = $3
     )`,
    [userId, points, reason, reportId],
  )
  // Ажурирај го агрегатот на корисникот само ако навистина е доделен нов поен.
  if (rowCount > 0) {
    await query(`UPDATE users SET points = points + $2 WHERE id = $1`, [userId, points])
  }
}

// Поени се добиваат само за пријави за КОНТЕЈНЕР и ДИВА ДЕПОНИЈА (не за загадување).
function isPointsEligible(type) {
  return type === 'container' || type === 'waste'
}

// Претвора ред од базата во чист објект. Сликите (BYTEA) НЕ се враќаат во телото;
// наместо тоа `photos` содржи URL-и до serving endpoint-от. Присуството се знае
// или од `has_photo_n` (во листата) или од самиот Buffer (кај RETURNING *).
function rowToReport(r) {
  const photos = []
  // Миризба: без слики во API одговорот (не се користат).
  if (r.type !== 'smell') {
    for (let n = 1; n <= config.maxPhotos; n++) {
      const has = r[`has_photo_${n}`] != null ? r[`has_photo_${n}`] : r[`photo_${n}`] != null
      if (has) photos.push(`/api/reports/${r.id}/photos/${n}`)
    }
  }
  const rest = { ...r }
  for (let n = 1; n <= config.maxPhotos; n++) {
    delete rest[`photo_${n}`]
    delete rest[`has_photo_${n}`]
  }
  return { ...rest, photos }
}

// Колони за листа — БЕЗ bytea (за да не се пренесуваат мегабајти слики по ред);
// само знамиња дали постои секоја слика.
const LIST_COLUMNS = `
  id, type, reporter_id, reporter_device_id, reporter_name, location_label, municipality, lat, lng,
  description, status, visibility, institution_id, forwarded_institution_id,
  intensity, severity, container_kind_id, container_issue, fill_percent,
  nearest_point_id, nearest_point_type, nearest_point_distance_m,
  created_at, updated_at, resolved_at,
  (photo_1 IS NOT NULL) AS has_photo_1,
  (photo_2 IS NOT NULL) AS has_photo_2,
  (photo_3 IS NOT NULL) AS has_photo_3,
  (photo_4 IS NOT NULL) AS has_photo_4,
  (photo_5 IS NOT NULL) AS has_photo_5,
  (photo_6 IS NOT NULL) AS has_photo_6`

// GET /api/reports?type=&status=  (кеширано + ETag/304)
reportsRouter.get('/', async (req, res, next) => {
  try {
    const type = req.query.type || ''
    const status = req.query.status || ''
    const producer = async () => {
      const clauses = []
      const params = []
      if (type) { params.push(type); clauses.push(`type = $${params.length}`) }
      if (status) { params.push(status); clauses.push(`status = $${params.length}`) }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
      const { rows } = await query(
        `SELECT ${LIST_COLUMNS} FROM reports ${where} ORDER BY created_at DESC LIMIT 500`,
        params,
      )
      return rows.map(rowToReport)
    }
    // На Vercel in-memory кешот не е споделен меѓу инстанци → свежи податоци.
    if (process.env.VERCEL) {
      await serveFreshJson(req, res, producer)
      return
    }
    await serveCachedJson(req, res, {
      key: `reports:${type}:${status}`,
      ttlMs: REPORTS_TTL_MS,
      producer,
    })
  } catch (err) { next(err) }
})

// GET /api/reports/:id/photos/:n — сервира една слика директно од база (BYTEA).
reportsRouter.get('/:id/photos/:n', async (req, res, next) => {
  try {
    const n = parseInt(req.params.n, 10)
    if (!(n >= 1 && n <= config.maxPhotos)) return res.status(404).end()
    // n е валидиран цел број 1..6 → безбедно за интерполација на име колона.
    const { rows } = await query(
      `SELECT photo_${n} AS img FROM reports WHERE id = $1`,
      [req.params.id],
    )
    const buf = rows[0]?.img
    if (!buf) return res.status(404).end()
    res.set('Content-Type', detectMime(buf))
    res.set('Cache-Control', 'public, max-age=604800, immutable')
    res.send(buf)
  } catch (err) { next(err) }
})

// POST /api/reports — прима слики како бинарни податоци и ги складира во BYTEA
// колони. Поддржува multipart (fields + `photos` фајлови) ИЛИ JSON (base64).
reportsRouter.post('/', upload.array('photos', config.maxPhotos), async (req, res, next) => {
  try {
    const type = str(req.body.type)
    const reporterId = str(req.body.reporterId)
    const reporterDeviceId = str(req.body.deviceId)
    const reporterName = str(req.body.reporterName)
    const reporterEmail = str(req.body.reporterEmail)
    const location = str(req.body.location)
    const municipality = str(req.body.municipality)
    const lat = num(req.body.lat)
    const lng = num(req.body.lng)
    const description = str(req.body.description)
    const institutionId = str(req.body.institutionId)
    const intensity = int(req.body.intensity)
    const severity = str(req.body.severity)
    const containerKind = str(req.body.containerKind)
    const containerIssue = str(req.body.containerIssue)
    const fill = int(req.body.fill)
    const nearestPointId = str(req.body.nearestPointId)
    const nearestPointType = str(req.body.nearestPointType)
    const nearestDistanceM = int(req.body.nearestDistanceM)

    if (!['smell', 'waste', 'container'].includes(type)) {
      return res.status(400).json({ error: 'Невалиден тип на пријава.' })
    }

    // Регистриран корисник → врзи ја пријавата за неговиот профил (за поени/историја).
    const resolvedReporterId = reporterId || await resolveUserId(reporterEmail, reporterName)

    // Секоја слика (бинарно) оди во посебна колона (макс. 6); дополни со NULL.
    // Пријавите за миризба НЕ чуваат слики — заштеда на меморија во базата.
    const p = type === 'smell' ? [] : gatherPhotoBuffers(req)
    while (p.length < config.maxPhotos) p.push(null)

    const { rows } = await query(
      `INSERT INTO reports (
        type, reporter_id, reporter_device_id, reporter_name, location_label, municipality, lat, lng, description,
        institution_id, intensity, severity, container_kind_id, container_issue, fill_percent,
        nearest_point_id, nearest_point_type, nearest_point_distance_m,
        photo_1, photo_2, photo_3, photo_4, photo_5, photo_6
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21, $22, $23, $24
      ) RETURNING *`,
      [
        type, resolvedReporterId, reporterDeviceId, reporterName, location, municipality, lat, lng, description,
        institutionId, intensity, severity, containerKind, containerIssue, fill,
        nearestPointId, nearestPointType, nearestDistanceM,
        p[0], p[1], p[2], p[3], p[4], p[5],
      ],
    )
    // Поени за поднесена пријава: +1, само за контејнер/дива депонија и само
    // за регистрирани корисници.
    if (isPointsEligible(type)) {
      await awardPointsOnce(resolvedReporterId, 1, 'report_submitted', rows[0].id)
    }
    // Свежи податоци веднаш за сите (не чекај TTL).
    invalidateCache('reports:')
    invalidateCache('leaderboard:')
    res.status(201).json(rowToReport(rows[0]))
  } catch (err) { next(err) }
})

// PATCH /api/reports/:id/status — ажурирање статус + аудит трага (само админ)
reportsRouter.patch('/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const { status, changedBy = null, note = null } = req.body
    if (!['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Невалиден статус.' })
    }
    const existing = await query('SELECT status FROM reports WHERE id = $1', [req.params.id])
    if (existing.rowCount === 0) return res.status(404).json({ error: 'Пријавата не постои.' })

    const oldStatus = existing.rows[0].status
    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null
    // report_status е PostgreSQL ENUM — $1 мора експлицитен cast, иначе CASE WHEN $1 = 'resolved'
    // дава „inconsistent types deduced for parameter $1" на Neon/production.
    const { rows } = await query(
      `UPDATE reports
         SET status = $1::report_status,
             visibility = CASE WHEN $1::report_status = 'resolved'::report_status THEN 'public' ELSE visibility END,
             resolved_at = COALESCE($2, resolved_at)
       WHERE id = $3 RETURNING *`,
      [status, resolvedAt, req.params.id],
    )
    await query(
      `INSERT INTO report_status_history (report_id, old_status, new_status, changed_by, note)
       VALUES ($1, $2::report_status, $3::report_status, $4, $5)`,
      [req.params.id, oldStatus, status, changedBy, note],
    )
    // Поени за решена пријава — на пријавувачот: +2 (вкупно 3 со пријавата),
    // само за контејнер/дива депонија, еднаш по пријава.
    if (status === 'resolved' && oldStatus !== 'resolved') {
      if (isPointsEligible(rows[0].type)) {
        await awardPointsOnce(rows[0].reporter_id, 2, 'report_resolved', rows[0].id)
      }
    }
    // Извести го пријавувачот при секоја промена на статус (не само resolved).
    if (status !== oldStatus) {
      const loc = rows[0].location_label || 'локација'
      const statusLabels = {
        pending: 'Поднесено',
        in_progress: 'Во тек на решавање',
        resolved: 'Решен проблем',
      }
      const statusLabel = statusLabels[status] || status
      const title = status === 'resolved' ? 'Пријавата е решена' : 'Статусот на пријавата е ажуриран'
      const body = status === 'resolved'
        ? `Твојата пријава (${loc}) е означена како решена. Ти благодариме!`
        : `Твојата пријава (${loc}) сега е: ${statusLabel}.`
      if (rows[0].reporter_id) {
        const { rows: userRows } = await query(
          'SELECT notif_waste FROM users WHERE id = $1',
          [rows[0].reporter_id],
        )
        if (userRows[0]?.notif_waste !== false) {
          await query(
            `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
            [rows[0].reporter_id, title, body],
          ).catch(() => {})
          sendPushToUser(rows[0].reporter_id, { title, body }).catch(() => {})
        }
      } else if (rows[0].reporter_device_id) {
        sendPushToDevice(rows[0].reporter_device_id, { title, body }).catch(() => {})
      }
      invalidateCache('notifications:')
    }
    invalidateCache('reports:')
    invalidateCache('leaderboard:')
    res.json(rowToReport(rows[0]))
  } catch (err) { next(err) }
})

// DELETE /api/reports/:id — трајно бришење (админ). Ги отстранува и BYTEA сликите
// од базата (ON DELETE CASCADE за историја; поените остануваат со report_id = NULL).
reportsRouter.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `DELETE FROM reports WHERE id = $1 RETURNING id, type`,
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Пријавата не постои.' })
    invalidateCache('reports:')
    invalidateCache('leaderboard:')
    res.json({ ok: true, id: rows[0].id, type: rows[0].type })
  } catch (err) { next(err) }
})
