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

// GET /api/cron/event-reminders — рачно или бесплатен надворешен cron (Acton crontab,
// cron-job.org, GitHub Actions). Query ?force=1 за тест. Vercel Cron е платен — не се користи.
cronRouter.get('/event-reminders', requireCronAuth, async (req, res, next) => {
  try {
    const force = req.query.force === '1'
    const result = await sendEventReminders24h({ force })
    res.json(result)
  } catch (err) { next(err) }
})
