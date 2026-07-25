import { Router } from 'express'
import { config } from '../config.js'
import { query } from '../db.js'
import { sendPushToUser } from '../lib/fcm.js'
import { invalidateCache, serveCachedJson, serveFreshJson } from '../lib/responseCache.js'
import { resolveUserId } from '../services/users.js'
import { tickEventRemindersOnTraffic } from '../services/eventReminders.js'

export const eventsRouter = Router()

// Клучот вклучува email заради „joined“. На Vercel секогаш свежо од база (поглед reports GET).
const EVENTS_TTL_MS = 15000

function formatEventTime(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') return raw.slice(0, 5)
  if (raw instanceof Date) {
    const h = String(raw.getUTCHours()).padStart(2, '0')
    const m = String(raw.getUTCMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
  return null
}

function normalizeEventTime(raw) {
  if (raw == null || raw === '') return null
  const s = String(raw).trim()
  if (!/^\d{1,2}:\d{2}$/.test(s)) return null
  const [h, m] = s.split(':').map(Number)
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Претвора ред + број пријавени во облик што го користи frontend-от.
function rowToEvent(r) {
  const date = r.event_date instanceof Date
    ? r.event_date.toISOString().slice(0, 10)
    : String(r.event_date || '').slice(0, 10)
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    date,
    time: formatEventTime(r.event_time),
    location: r.location,
    seats: r.seats,
    status: r.status,
    organizer: r.organizer_name,
    organizerEmail: r.organizer_email || null,
    organizerInstagram: r.organizer_instagram || null,
    reminderMessage: r.reminder_message || '',
    signupCount: Number(r.signup_count || 0),
    joined: Boolean(r.joined),
    createdAt: r.created_at,
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

async function assertOrganizerOrAdmin(eventId, email, adminToken) {
  const { rows } = await query(
    `SELECT ou.email AS organizer_email
       FROM events e
       LEFT JOIN users ou ON ou.id = e.organizer_id
      WHERE e.id = $1`,
    [eventId],
  )
  if (!rows[0]) return { ok: false, status: 404, error: 'Настанот не постои.' }
  const orgEmail = rows[0].organizer_email
  const isOrganizer = email && orgEmail
    && String(email).toLowerCase() === String(orgEmail).toLowerCase()
  const isAdmin = config.adminToken && adminToken === config.adminToken
  if (!isOrganizer && !isAdmin) {
    return { ok: false, status: 403, error: 'Само организаторот може да ги види пријавените.' }
  }
  return { ok: true }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/events?email=  → сите настани (јавни) + дали тековниот корисник е пријавен
eventsRouter.get('/', async (req, res, next) => {
  try {
    void tickEventRemindersOnTraffic()
    const email = req.query.email || null
    const producer = async () => {
      const { rows } = await query(
        `SELECT e.*,
           ou.email AS organizer_email,
           ou.instagram_handle AS organizer_instagram,
           (SELECT COUNT(*) FROM event_signups s WHERE s.event_id = e.id) AS signup_count,
           EXISTS(
             SELECT 1 FROM event_signups s
             JOIN users u ON u.id = s.user_id
             WHERE s.event_id = e.id AND u.email = $1
           ) AS joined
         FROM events e
         LEFT JOIN users ou ON ou.id = e.organizer_id
         ORDER BY e.event_date ASC`,
        [email],
      )
      return rows.map(rowToEvent)
    }
    if (process.env.VERCEL) {
      await serveFreshJson(req, res, producer)
      return
    }
    await serveCachedJson(req, res, {
      key: `events:${email || 'anon'}`,
      ttlMs: EVENTS_TTL_MS,
      producer,
    })
  } catch (err) { next(err) }
})

// POST /api/events  → креира настан (организација)
eventsRouter.post('/', async (req, res, next) => {
  try {
    const {
      title, description = null, date, time = null, location = null,
      seats = 0, organizerEmail = null, organizerName = null,
      reminderMessage = null,
    } = req.body
    if (!title || !date) return res.status(400).json({ error: 'Недостасува наслов или датум.' })
    if (organizerEmail) {
      const { rows: orgRows } = await query(
        `SELECT role FROM users WHERE email = $1`,
        [organizerEmail],
      )
      const role = orgRows[0]?.role
      if (role && role !== 'organization' && role !== 'admin') {
        return res.status(403).json({ error: 'Само community корисници можат да креираат настани.' })
      }
    }
    const isoDate = String(date).slice(0, 10)
    if (isoDate < todayIso()) {
      return res.status(400).json({ error: 'Не може да се креира настан со датум во минатото.' })
    }
    const eventTime = normalizeEventTime(time)
    if (time && !eventTime) {
      return res.status(400).json({ error: 'Невалиден час (користи HH:MM).' })
    }
    const reminder = reminderMessage != null ? String(reminderMessage).trim().slice(0, 500) : null
    const organizerId = await resolveUserId(organizerEmail, organizerName)
    const { rows } = await query(
      `INSERT INTO events (title, description, event_date, event_time, location, seats, organizer_id, organizer_name, reminder_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, description, isoDate, eventTime, location, seats, organizerId, organizerName || organizerEmail, reminder || null],
    )
    let organizerInstagram = null
    if (organizerId) {
      const ig = await query('SELECT instagram_handle FROM users WHERE id = $1', [organizerId])
      organizerInstagram = ig.rows[0]?.instagram_handle || null
    }
    invalidateCache('events:')
    res.status(201).json(rowToEvent({
      ...rows[0],
      signup_count: 0,
      joined: false,
      organizer_instagram: organizerInstagram,
    }))
  } catch (err) { next(err) }
})

// DELETE /api/events/:id  → откажување/бришење настан (организатор или админ).
// Настанот исчезнува за сите корисници (event_signups се бришат каскадно).
eventsRouter.delete('/:id', async (req, res, next) => {
  try {
    const email = req.query.email || req.body?.email || null
    const { rows } = await query(
      `SELECT (SELECT email FROM users WHERE id = e.organizer_id) AS organizer_email
       FROM events e WHERE e.id = $1`,
      [req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Настанот не постои.' })

    const organizerEmail = rows[0].organizer_email
    const isOrganizer = email && organizerEmail && String(email).toLowerCase() === String(organizerEmail).toLowerCase()
    // Ако адмн токен не е поставен → отворено (локален развој), инаку мора да се совпаѓа.
    const provided = req.get('x-admin-token') || ''
    const isAdmin = !config.adminToken || provided === config.adminToken

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Само организаторот или админ може да го откаже настанот.' })
    }
    await query('DELETE FROM events WHERE id = $1', [req.params.id])
    invalidateCache('events:')
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// GET /api/events/:id/signups?email=  → листа пријавени (организатор или админ)
eventsRouter.get('/:id/signups', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'Невалиден настан.' })
    }
    const email = req.query.email || null
    const adminToken = req.get('x-admin-token') || ''
    const access = await assertOrganizerOrAdmin(req.params.id, email, adminToken)
    if (!access.ok) return res.status(access.status).json({ error: access.error })

    const { rows } = await query(
      `SELECT s.full_name, s.email, s.note, s.created_at
         FROM event_signups s
        WHERE s.event_id = $1
        ORDER BY s.created_at ASC`,
      [req.params.id],
    )
    res.json(rows.map((r) => ({
      fullName: r.full_name,
      email: r.email,
      note: r.note || '',
      signedUpAt: r.created_at,
    })))
  } catch (err) { next(err) }
})

// POST /api/events/:id/signup  → пријавување (регистриран корисник)
eventsRouter.post('/:id/signup', async (req, res, next) => {
  try {
    const { email = null, fullName = null, note = null } = req.body
    if (!email) return res.status(400).json({ error: 'Потребна е најава за пријавување.' })
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'Настанот сè уште се зачувува. Обидете се повторно за момент.' })
    }

    const { rows: eventRows } = await query(
      `SELECT e.event_date, ou.email AS organizer_email
         FROM events e
         LEFT JOIN users ou ON ou.id = e.organizer_id
        WHERE e.id = $1`,
      [req.params.id],
    )
    if (!eventRows[0]) return res.status(404).json({ error: 'Настанот не постои.' })

    const eventDate = eventRows[0].event_date instanceof Date
      ? eventRows[0].event_date.toISOString().slice(0, 10)
      : String(eventRows[0].event_date || '').slice(0, 10)
    if (eventDate < todayIso()) {
      return res.status(400).json({ error: 'Настанот веќе помина — пријавувањето не е достапно.' })
    }

    const organizerEmail = eventRows[0].organizer_email
    if (organizerEmail && String(email).toLowerCase() === String(organizerEmail).toLowerCase()) {
      return res.status(400).json({ error: 'ORGANIZER_CANNOT_SIGNUP' })
    }

    const userId = await resolveUserId(email, fullName)
    const inserted = await query(
      `INSERT INTO event_signups (event_id, user_id, full_name, email, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [req.params.id, userId, fullName || email, email, note],
    )
    // Автоматски вклучи потсетници за настани при пријава (24ч push/in-app).
    if (userId) {
      await query(`UPDATE users SET notif_events = TRUE WHERE id = $1`, [userId])
    }
    // +1 поен за еко-акција (учество на настан) — еднаш по (корисник, настан),
    // само при првото пријавување (одјава/повторна пријава не дуплира).
    if (inserted.rowCount > 0 && userId) {
      const reason = `event_joined:${req.params.id}`
      const { rowCount } = await query(
        `INSERT INTO points_events (user_id, points, reason)
         SELECT $1, 1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM points_events WHERE user_id = $1 AND reason = $2
         )`,
        [userId, reason],
      )
      if (rowCount > 0) {
        await query(`UPDATE users SET points = points + 1 WHERE id = $1`, [userId])
      }
      invalidateCache('leaderboard:')
    }
    invalidateCache('events:')
    res.status(201).json({ ok: true })
  } catch (err) { next(err) }
})

// POST /api/events/:id/remind  → организаторот праќа рачен потсетник (in-app + FCM push)
eventsRouter.post('/:id/remind', async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ error: 'Невалиден настан.' })
    }
    const email = req.body?.email || null
    const adminToken = req.get('x-admin-token') || ''
    const access = await assertOrganizerOrAdmin(req.params.id, email, adminToken)
    if (!access.ok) return res.status(access.status).json({ error: access.error })

    const { rows: eventRows } = await query(
      `SELECT id, title, location, event_date, event_time, reminder_message
         FROM events WHERE id = $1`,
      [req.params.id],
    )
    if (!eventRows[0]) return res.status(404).json({ error: 'Настанот не постои.' })
    const event = eventRows[0]

    const fromBody = req.body?.message != null ? String(req.body.message).trim() : ''
    const stored = event.reminder_message ? String(event.reminder_message).trim() : ''
    const message = (fromBody || stored || '').slice(0, 500)
    if (!message) {
      return res.status(400).json({ error: 'Напишете порака за потсетникот.' })
    }

    // Зачувај ја последната порака за следни потсетници.
    if (fromBody && fromBody !== stored) {
      await query(`UPDATE events SET reminder_message = $1 WHERE id = $2`, [message, event.id])
    }

    const timeLabel = formatEventTime(event.event_time)
    const dateLabel = event.event_date instanceof Date
      ? event.event_date.toISOString().slice(0, 10)
      : String(event.event_date || '').slice(0, 10)
    const when = timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel
    const title = `Потсетник: ${event.title}`
    const body = `${message}\n\n${when}${event.location ? ` — ${event.location}` : ''}`

    const { rows: signups } = await query(
      `SELECT DISTINCT s.user_id
         FROM event_signups s
         JOIN users u ON u.id = s.user_id
        WHERE s.event_id = $1 AND s.user_id IS NOT NULL
          AND COALESCE(u.notif_events, TRUE) = TRUE`,
      [event.id],
    )
    if (signups.length === 0) {
      return res.status(400).json({ error: 'Нема пријавени учесници за потсетник.' })
    }

    let sent = 0
    for (const row of signups) {
      await query(
        `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
        [row.user_id, title, body],
      ).catch(() => {})
      sendPushToUser(row.user_id, { title, body }).catch(() => {})
      sent += 1
    }

    invalidateCache('notifications:')
    invalidateCache('events:')
    res.json({ ok: true, sent })
  } catch (err) { next(err) }
})

// DELETE /api/events/:id/signup?email=  → откажување
eventsRouter.delete('/:id/signup', async (req, res, next) => {
  try {
    const email = req.query.email
    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    const userId = await resolveUserId(email)
    const { rowCount: signupRemoved } = await query(
      `DELETE FROM event_signups s
         USING users u
       WHERE s.user_id = u.id AND s.event_id = $1 AND u.email = $2`,
      [req.params.id, email],
    )
    // Врати го поенот доделен при пријава (event_joined) — само ако навистина се откажа.
    if (signupRemoved > 0 && userId) {
      const reason = `event_joined:${req.params.id}`
      const { rowCount: pointsRemoved } = await query(
        `DELETE FROM points_events WHERE user_id = $1 AND reason = $2`,
        [userId, reason],
      )
      if (pointsRemoved > 0) {
        await query(`UPDATE users SET points = GREATEST(0, points - 1) WHERE id = $1`, [userId])
        invalidateCache('leaderboard:')
      }
    }
    invalidateCache('events:')
    res.json({ ok: true })
  } catch (err) { next(err) }
})
