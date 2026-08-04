import { Router } from 'express'
import { query } from '../db.js'
import { sendPushToUser, sendPushToUsers } from '../lib/fcm.js'
import { invalidateCache, serveCachedJson } from '../lib/responseCache.js'
import { requireSuperAdmin } from '../middleware/requireAdmin.js'

export const leaderboardRouter = Router()

const LEADERBOARD_TTL_MS = 15000
const MAX_AWARD_PLACE = 5

function currentPeriodMonth() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function rowToAward(r) {
  return {
    id: r.id,
    periodMonth: r.period_month,
    place: Number(r.place),
    userId: r.user_id,
    email: r.email || null,
    name: r.display_name || r.email || null,
    message: r.message,
    status: r.status,
    contactName: r.contact_name,
    contactPhone: r.contact_phone,
    contactEmail: r.contact_email,
    contactNote: r.contact_note,
    notifiedAt: r.notified_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    points: r.points != null ? Number(r.points) : undefined,
  }
}

// GET /api/leaderboard  → месечен ранг (само >0)
leaderboardRouter.get('/', async (req, res, next) => {
  try {
    await serveCachedJson(req, res, {
      key: 'leaderboard:monthly',
      ttlMs: LEADERBOARD_TTL_MS,
      producer: async () => {
        const { rows } = await query(
          `SELECT user_id, display_name, email, points
           FROM leaderboard_monthly
           WHERE points > 0
           ORDER BY points DESC`,
        )
        return rows.map((r) => ({
          id: r.user_id,
          userId: r.email || r.user_id,
          name: r.display_name || r.email,
          email: r.email,
          points: Number(r.points),
        }))
      },
    })
  } catch (err) { next(err) }
})

// GET /api/leaderboard/me?email=
leaderboardRouter.get('/me', async (req, res, next) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    const { rows } = await query(
      `SELECT l.points,
              (SELECT COUNT(*) + 1 FROM leaderboard_monthly x
               WHERE x.points > l.points AND x.points > 0) AS rank
       FROM leaderboard_monthly l
       WHERE lower(l.email) = $1`,
      [email],
    )
    if (!rows.length || Number(rows[0].points) <= 0) {
      return res.json({ points: rows.length ? Number(rows[0].points) : 0, rank: null })
    }
    res.json({ points: Number(rows[0].points), rank: Number(rows[0].rank) })
  } catch (err) { next(err) }
})

// GET /api/leaderboard/awards?month=YYYY-MM-01 — супер админ листа
leaderboardRouter.get('/awards', requireSuperAdmin, async (req, res, next) => {
  try {
    const month = String(req.query.month || currentPeriodMonth()).slice(0, 10)
    const { rows } = await query(
      `SELECT a.*, u.email, u.display_name,
              COALESCE((
                SELECT SUM(pe.points) FROM points_events pe
                WHERE pe.user_id = a.user_id
                  AND pe.created_at >= a.period_month
                  AND pe.created_at < (a.period_month + INTERVAL '1 month')
              ), 0) AS points
       FROM leaderboard_awards a
       JOIN users u ON u.id = a.user_id
       WHERE a.period_month = $1::date
       ORDER BY a.place ASC`,
      [month],
    )
    res.json(rows.map(rowToAward))
  } catch (err) { next(err) }
})

// GET /api/leaderboard/awards/mine?email= — отворена награда за тековен месец
leaderboardRouter.get('/awards/mine', async (req, res, next) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    const month = currentPeriodMonth()
    const { rows } = await query(
      `SELECT a.*, u.email, u.display_name
       FROM leaderboard_awards a
       JOIN users u ON u.id = a.user_id
       WHERE lower(u.email) = $1
         AND a.period_month = $2::date
         AND a.status = 'pending_contact'
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [email, month],
    )
    res.json(rows[0] ? rowToAward(rows[0]) : null)
  } catch (err) { next(err) }
})

// POST /api/leaderboard/awards — супер админ испраќа награда + push
// body: { place, email | userId, message, month? }
leaderboardRouter.post('/awards', requireSuperAdmin, async (req, res, next) => {
  try {
    const place = Number(req.body?.place)
    const message = String(req.body?.message || '').trim()
    const month = String(req.body?.month || currentPeriodMonth()).slice(0, 10)
    const email = String(req.body?.email || '').trim().toLowerCase()
    let userId = req.body?.userId || null

    if (!Number.isInteger(place) || place < 1 || place > MAX_AWARD_PLACE) {
      return res.status(400).json({ error: `Местото мора да биде од 1 до ${MAX_AWARD_PLACE}.` })
    }
    if (!message || message.length > 500) {
      return res.status(400).json({ error: 'Пораката е задолжителна (макс. 500 знаци).' })
    }

    if (!userId && email) {
      const { rows } = await query('SELECT id FROM users WHERE lower(email) = $1', [email])
      userId = rows[0]?.id || null
    }
    if (!userId) return res.status(400).json({ error: 'Недостасува корисник (email / userId).' })

    const { rows: userRows } = await query(
      'SELECT id, email, display_name FROM users WHERE id = $1 AND is_anonymous = FALSE',
      [userId],
    )
    if (!userRows[0]) return res.status(404).json({ error: 'Корисникот не постои.' })

    const { rows } = await query(
      `INSERT INTO leaderboard_awards
         (period_month, place, user_id, message, status, notified_at, created_by)
       VALUES ($1::date, $2, $3, $4, 'pending_contact', now(), $5)
       ON CONFLICT (period_month, place) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             message = EXCLUDED.message,
             status = 'pending_contact',
             contact_name = NULL,
             contact_phone = NULL,
             contact_email = NULL,
             contact_note = NULL,
             notified_at = now(),
             created_by = EXCLUDED.created_by,
             updated_at = now()
       RETURNING *`,
      [month, place, userId, message, req.adminUserId || null],
    )

    // Ако истиот user веќе има друго место во месецот — уникатниот индекс ќе фрли.
    // Повторно испрати за исто место е OK (upsert по place).

    const award = rows[0]
    const title = `Честитки — ${place}. место!`
    const body = message

    await query(
      `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
      [userId, title, body],
    ).catch(() => {})

    await sendPushToUser(userId, {
      title,
      body,
      data: {
        type: 'leaderboard_award',
        awardId: String(award.id),
        place: String(place),
      },
    }).catch(() => {})

    invalidateCache('notifications:')
    res.status(201).json(rowToAward({ ...award, email: userRows[0].email, display_name: userRows[0].display_name }))
  } catch (err) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Овој корисник веќе има награда за овој месец (друго место).' })
    }
    next(err)
  }
})

// PATCH /api/leaderboard/awards/:id/contact — наградениот ги праќа контакт податоците
leaderboardRouter.patch('/awards/:id/contact', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const contactName = String(req.body?.contactName || '').trim()
    const contactPhone = String(req.body?.contactPhone || '').trim()
    const contactEmail = String(req.body?.contactEmail || email || '').trim()
    const contactNote = String(req.body?.contactNote || '').trim()

    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    if (!contactName || contactName.length > 120) {
      return res.status(400).json({ error: 'Името е задолжително (макс. 120 знаци).' })
    }
    if (!contactPhone || contactPhone.length > 40) {
      return res.status(400).json({ error: 'Телефонот е задолжителен (макс. 40 знаци).' })
    }

    const { rows: owned } = await query(
      `SELECT a.id FROM leaderboard_awards a
       JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND lower(u.email) = $2 AND a.status = 'pending_contact'`,
      [req.params.id, email],
    )
    if (!owned.length) {
      return res.status(404).json({ error: 'Наградата не постои или веќе е пополнета.' })
    }

    const { rows } = await query(
      `UPDATE leaderboard_awards
          SET contact_name = $2,
              contact_phone = $3,
              contact_email = $4,
              contact_note = NULLIF($5, ''),
              status = 'contact_submitted',
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [req.params.id, contactName, contactPhone, contactEmail || null, contactNote],
    )

    // Извести супер админи дека има контакт за награда.
    const { rows: admins } = await query(
      `SELECT id FROM users WHERE role::text = 'admin' AND is_anonymous = FALSE`,
    )
    const adminIds = admins.map((a) => a.id)
    const title = 'Контакт за награда'
    const body = `${contactName} (${contactPhone}) — ${rows[0].place}. место`
    await Promise.all(adminIds.map((id) => query(
      `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
      [id, title, body],
    ).catch(() => {})))
    if (adminIds.length) {
      await sendPushToUsers(adminIds, {
        title,
        body,
        data: { type: 'leaderboard_award_contact', awardId: String(rows[0].id) },
      }).catch(() => {})
    }

    invalidateCache('notifications:')
    const { rows: withUser } = await query(
      `SELECT a.*, u.email, u.display_name FROM leaderboard_awards a
       JOIN users u ON u.id = a.user_id WHERE a.id = $1`,
      [rows[0].id],
    )
    res.json(rowToAward(withUser[0]))
  } catch (err) { next(err) }
})
