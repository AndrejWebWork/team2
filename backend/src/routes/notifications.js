import { Router } from 'express'
import { query } from '../db.js'
import { invalidateCache } from '../lib/responseCache.js'
import { resolveUserId } from '../services/users.js'

export const notificationsRouter = Router()

function rowToNotification(r) {
  const created = r.created_at ? new Date(r.created_at) : new Date()
  const today = new Date()
  const isToday = created.toDateString() === today.toDateString()
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    read: r.is_read,
    group: isToday ? 'Денес' : 'Порано',
    createdAt: r.created_at,
  }
}

// GET /api/notifications?email=  → broadcast (за сите) + личните на корисникот
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const email = req.query.email || null
    const { rows } = await query(
      `SELECT n.* FROM notifications n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.user_id IS NULL OR u.email = $1
       ORDER BY n.created_at DESC
       LIMIT 100`,
      [email],
    )
    res.json(rows.map(rowToNotification))
  } catch (err) { next(err) }
})

// POST /api/notifications/air-alert  { email, title, body }
// In-app само (без FCM). Backend го почитува users.notif_air.
notificationsRouter.post('/air-alert', async (req, res, next) => {
  try {
    const { email, title, body = null } = req.body
    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    if (!title) return res.status(400).json({ error: 'Недостасува наслов.' })
    const userId = await resolveUserId(email)
    if (!userId) return res.status(404).json({ error: 'Корисникот не постои.' })
    const { rows: users } = await query('SELECT notif_air FROM users WHERE id = $1', [userId])
    if (!users[0]?.notif_air) return res.json({ ok: true, skipped: true, reason: 'notif_air_disabled' })
    const { rows } = await query(
      `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3) RETURNING *`,
      [userId, title, body],
    )
    invalidateCache('notifications:')
    res.status(201).json(rowToNotification(rows[0]))
  } catch (err) { next(err) }
})

// POST /api/notifications  { title, body, email? }  (email отсутен = broadcast)
notificationsRouter.post('/', async (req, res, next) => {
  try {
    const { title, body = null, email = null } = req.body
    if (!title) return res.status(400).json({ error: 'Недостасува наслов.' })
    const userId = await resolveUserId(email)
    const { rows } = await query(
      `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3) RETURNING *`,
      [userId, title, body],
    )
    res.status(201).json(rowToNotification(rows[0]))
  } catch (err) { next(err) }
})

// PATCH /api/notifications/:id/read  → означи една како прочитана
notificationsRouter.patch('/:id/read', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *`,
      [req.params.id],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Известувањето не постои.' })
    res.json(rowToNotification(rows[0]))
  } catch (err) { next(err) }
})

// PATCH /api/notifications/read-all  { email }  → означи ги сите за корисникот
notificationsRouter.patch('/read-all', async (req, res, next) => {
  try {
    const email = req.body.email || null
    await query(
      `UPDATE notifications n SET is_read = TRUE
       FROM users u
       WHERE (n.user_id IS NULL) OR (n.user_id = u.id AND u.email = $1)`,
      [email],
    )
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// DELETE /api/notifications/:id?email=  → брише лично известување; broadcast се отстранува само локално
notificationsRouter.delete('/:id', async (req, res, next) => {
  try {
    const email = req.query.email || null
    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    const { rows } = await query(
      `DELETE FROM notifications n
       USING users u
       WHERE n.id = $1 AND n.user_id = u.id AND u.email = $2
       RETURNING n.id`,
      [req.params.id, email],
    )
    res.json({ ok: true, removed: rows.length > 0 })
  } catch (err) { next(err) }
})
