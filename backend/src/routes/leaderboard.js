import { Router } from 'express'
import { query } from '../db.js'
import { serveCachedJson } from '../lib/responseCache.js'

export const leaderboardRouter = Router()

// Лидербордот е ист за сите → краток кеш (брз одговор, свежи поени).
const LEADERBOARD_TTL_MS = 15000

// GET /api/leaderboard  → месечен ранг од погледот leaderboard_monthly (само >0)
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
          userId: r.email || r.user_id,
          name: r.display_name || r.email,
          points: Number(r.points),
        }))
      },
    })
  } catch (err) { next(err) }
})

// GET /api/leaderboard/me?email=… → ранг и поени на конкретен корисник МЕЃУ
// СИТЕ корисници (не само топ 100). Ранг = 1 + број на корисници со строго
// повеќе поени (стандарден натпреварувачки ранг: исти поени = ист ранг).
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
