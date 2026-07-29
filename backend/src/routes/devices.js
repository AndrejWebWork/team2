import { Router } from 'express'
import { query } from '../db.js'
import { resolveUserId } from '../services/users.js'

export const devicesRouter = Router()

// POST /api/devices/token  { token, email?, deviceId?, platform? }
// Зачувува/освежува FCM токен за push. Врзан за корисник (ако е најавен,
// вклучително админ улоги) или за анонимен уред.
devicesRouter.post('/token', async (req, res, next) => {
  try {
    const { token, email = null, deviceId = null, platform = null } = req.body
    if (!token) return res.status(400).json({ error: 'Недостасува токен.' })
    const userId = email ? await resolveUserId(email) : null
    await query(
      `INSERT INTO device_tokens (token, user_id, device_id, platform)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             device_id = EXCLUDED.device_id,
             platform = EXCLUDED.platform,
             updated_at = now()`,
      [token, userId, deviceId, platform],
    )
    res.status(201).json({ ok: true })
  } catch (err) { next(err) }
})

// DELETE /api/devices/token  { token }  → отповикување (пр. при одјава)
devicesRouter.delete('/token', async (req, res, next) => {
  try {
    const token = req.body?.token || req.query.token
    if (!token) return res.status(400).json({ error: 'Недостасува токен.' })
    await query('DELETE FROM device_tokens WHERE token = $1', [token])
    res.json({ ok: true })
  } catch (err) { next(err) }
})
