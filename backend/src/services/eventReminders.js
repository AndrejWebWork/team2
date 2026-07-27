import { query } from '../db.js'
import { sendPushToUser } from '../lib/fcm.js'
import { invalidateCache } from '../lib/responseCache.js'

const TZ = 'Europe/Skopje'
const REMINDER_HOUR = 10 // 10:00 по Скопје ≈ 24ч пред претпоставен почеток на следниот ден

function skopjeParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: Number(parts.hour),
  }
}

/** ISO датум (YYYY-MM-DD) за „утре" во Europe/Skopje. */
export function skopjeTomorrowIso(from = new Date()) {
  const { year, month, day } = skopjeParts(from)
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12))
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function formatEventDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

async function notifySignup(userId, title, body) {
  if (!userId) return
  await query(
    `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
    [userId, title, body],
  ).catch(() => {})
  await sendPushToUser(userId, {
    title,
    body: String(body).replace(/\n+/g, ' · '),
    data: { type: 'event_reminder_24h' },
  }).catch(() => {})
}

/** Испраќа 24ч потсетник до сите пријавени (со notif_events) за настани утре. */
export async function sendEventReminders24h({ force = false } = {}) {
  const now = new Date()
  const { hour } = skopjeParts(now)
  if (!force && hour !== REMINDER_HOUR) {
    return { ok: true, skipped: true, reason: 'outside_reminder_window', hour, sent: 0, events: 0 }
  }

  const tomorrow = skopjeTomorrowIso(now)
  const { rows: events } = await query(
    `SELECT id, title, location, event_date, event_time, reminder_message
       FROM events
      WHERE event_date = $1::date
        AND reminder_24h_sent_at IS NULL`,
    [tomorrow],
  )

  let sent = 0
  for (const event of events) {
    const dateLabel = formatEventDate(event.event_date)
    const timeRaw = event.event_time
    const timeLabel = timeRaw == null ? '' : String(timeRaw).slice(0, 5)
    const loc = event.location || 'Скопје'
    const title = 'Потсетник: настан за 24 часа'
    const when = timeLabel ? `${dateLabel} во ${timeLabel}` : dateLabel
    const custom = event.reminder_message ? String(event.reminder_message).trim() : ''
    const body = custom
      ? `${custom}\n\nУтре (${when}) следи „${event.title}" — ${loc}.`
      : `Утре (${when}) следи „${event.title}" — ${loc}. Ви благодариме што учествувате!`

    const { rows: signups } = await query(
      `SELECT s.user_id, u.notif_events
         FROM event_signups s
         JOIN users u ON u.id = s.user_id
        WHERE s.event_id = $1
          AND COALESCE(u.notif_events, TRUE) = TRUE`,
      [event.id],
    )

    for (const row of signups) {
      await notifySignup(row.user_id, title, body)
      sent += 1
    }

    await query(
      `UPDATE events SET reminder_24h_sent_at = now() WHERE id = $1`,
      [event.id],
    )
  }

  if (sent > 0) invalidateCache('notifications:')

  return { ok: true, skipped: false, tomorrow, sent, events: events.length }
}

/** Бесплатна алтернатива на Vercel Cron: при сообраќај околу 10:00 по Скопје
 *  (health ping, листа настани). Advisory lock спречува дупликати на serverless. */
export function tickEventRemindersOnTraffic() {
  const { hour } = skopjeParts()
  if (hour !== REMINDER_HOUR) return Promise.resolve(null)

  return (async () => {
    const { rows } = await query('SELECT pg_try_advisory_lock(8240024) AS ok')
    if (!rows[0]?.ok) return null
    try {
      return await sendEventReminders24h()
    } finally {
      await query('SELECT pg_advisory_unlock(8240024)').catch(() => {})
    }
  })().catch(() => null)
}
