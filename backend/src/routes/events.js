import { Router } from 'express'
import { config } from '../config.js'
import { query } from '../db.js'
import { invalidateCache, serveCachedJson } from '../lib/responseCache.js'
import { resolveUserId } from '../services/users.js'

export const eventsRouter = Router()

// Настаните ретко се менуваат → кеш 10s. Клучот вклучува email заради „joined“.
const EVENTS_TTL_MS = 10000

// Претвора ред + број пријавени во облик што го користи frontend-от.
function rowToEvent(r) {
  const date = r.event_date instanceof Date
    ? r.event_date.toISOString().slice(0, 10)
    : r.event_date
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    date,
    location: r.location,
    seats: r.seats,
    status: r.status,
    organizer: r.organizer_name,
    signupCount: Number(r.signup_count || 0),
    joined: Boolean(r.joined),
    createdAt: r.created_at,
  }
}

// GET /api/events?email=  → сите настани (јавни) + дали тековниот корисник е пријавен
eventsRouter.get('/', async (req, res, next) => {
  try {
    const email = req.query.email || null
    await serveCachedJson(req, res, {
      key: `events:${email || 'anon'}`,
      ttlMs: EVENTS_TTL_MS,
      producer: async () => {
        const { rows } = await query(
          `SELECT e.*,
             (SELECT COUNT(*) FROM event_signups s WHERE s.event_id = e.id) AS signup_count,
             EXISTS(
               SELECT 1 FROM event_signups s
               JOIN users u ON u.id = s.user_id
               WHERE s.event_id = e.id AND u.email = $1
             ) AS joined
           FROM events e
           ORDER BY e.event_date ASC`,
          [email],
        )
        return rows.map(rowToEvent)
      },
    })
  } catch (err) { next(err) }
})

// POST /api/events  → креира настан (организација)
eventsRouter.post('/', async (req, res, next) => {
  try {
    const {
      title, description = null, date, location = null,
      seats = 0, organizerEmail = null, organizerName = null,
    } = req.body
    if (!title || !date) return res.status(400).json({ error: 'Недостасува наслов или датум.' })
    const organizerId = await resolveUserId(organizerEmail, organizerName)
    const { rows } = await query(
      `INSERT INTO events (title, description, event_date, location, seats, organizer_id, organizer_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, date, location, seats, organizerId, organizerName || organizerEmail],
    )
    invalidateCache('events:')
    res.status(201).json(rowToEvent({ ...rows[0], signup_count: 0, joined: false }))
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

// POST /api/events/:id/signup  → пријавување (регистриран корисник)
eventsRouter.post('/:id/signup', async (req, res, next) => {
  try {
    const { email = null, fullName = null, note = null } = req.body
    if (!email) return res.status(400).json({ error: 'Потребна е најава за пријавување.' })
    const userId = await resolveUserId(email, fullName)
    const inserted = await query(
      `INSERT INTO event_signups (event_id, user_id, full_name, email, note)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [req.params.id, userId, fullName || email, email, note],
    )
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

// DELETE /api/events/:id/signup?email=  → откажување
eventsRouter.delete('/:id/signup', async (req, res, next) => {
  try {
    const email = req.query.email
    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    await query(
      `DELETE FROM event_signups s
         USING users u
       WHERE s.user_id = u.id AND s.event_id = $1 AND u.email = $2`,
      [req.params.id, email],
    )
    invalidateCache('events:')
    res.json({ ok: true })
  } catch (err) { next(err) }
})
