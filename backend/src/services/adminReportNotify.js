import { query } from '../db.js'
import { sendPushToUsers } from '../lib/fcm.js'
import { adminRolesForReportType } from '../lib/roles.js'
import { invalidateCache } from '../lib/responseCache.js'

const TYPE_LABELS = {
  waste: 'Дива депонија',
  smell: 'Миризба / загаден воздух',
  container: 'Контејнер',
}

/**
 * Известува СИТЕ админи (Супер + подадмини) за нова пријава.
 * Best-effort: грешка во push/in-app НЕ смее да го сруши креирањето на пријавата.
 */
export async function notifyAdminsOfNewReport(report) {
  if (!report?.id || !report?.type) return { notified: 0, pushed: 0 }

  const roles = adminRolesForReportType(report.type)
  const { rows: admins } = await query(
    `SELECT id FROM users
      WHERE role::text = ANY($1::text[])
        AND is_anonymous = FALSE`,
    [roles],
  )

  // Не праќај на самиот пријавувач ако случајно е админ.
  const targets = admins
    .map((a) => a.id)
    .filter((id) => !report.reporter_id || id !== report.reporter_id)

  if (targets.length === 0) return { notified: 0, pushed: 0 }

  const loc = report.location_label || report.municipality || 'непозната локација'
  const typeLabel = TYPE_LABELS[report.type] || report.type
  const title = 'Нова пријава'
  const body = `${typeLabel}: ${loc}`
  const data = {
    type: 'report_created',
    reportId: String(report.id),
    reportType: String(report.type),
  }

  await Promise.all(targets.map((userId) => query(
    `INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)`,
    [userId, title, body],
  ).catch(() => {})))

  const pushed = await sendPushToUsers(targets, { title, body, data }).catch(() => 0)
  invalidateCache('notifications:')
  return { notified: targets.length, pushed }
}
