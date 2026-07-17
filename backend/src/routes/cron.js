import { Router } from 'express'
import { config } from '../config.js'
import { sendEventReminders24h } from '../services/eventReminders.js'

export const cronRouter = Router()

function requireCronAuth(req, res, next) {
  const secret = config.cronSecret
  if (!secret) return next()
  const auth = req.get('authorization') || ''
  if (auth === `Bearer ${secret}`) return next()
  return res.status(401).json({ error: 'Unauthorized' })
}

// GET /api/cron/event-reminders — Vercel Cron (на секој час; праќа во 10:00 CET/CEST)
// Query ?force=1 за тест (локално или со CRON_SECRET).
cronRouter.get('/event-reminders', requireCronAuth, async (req, res, next) => {
  try {
    const force = req.query.force === '1'
    const result = await sendEventReminders24h({ force })
    res.json(result)
  } catch (err) { next(err) }
})
