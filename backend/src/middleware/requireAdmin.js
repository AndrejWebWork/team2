import { config } from '../config.js'
import { query } from '../db.js'
import { canAccessReportType, canApproveEvents, isAdminRole, isSuperAdmin } from '../lib/roles.js'

// Штити ги админ операциите (пр. менување статус на пријава).
// Клиентот испраќа `X-Admin-Token` + `X-Admin-Email` (улогата се чита од база).
// Ако ADMIN_TOKEN не е поставен (локален развој), заштитата на токен се прескокнува.
export async function requireAdmin(req, res, next) {
  try {
    if (config.adminToken) {
      const provided = req.get('x-admin-token') || ''
      if (!provided || provided !== config.adminToken) {
        return res.status(401).json({ error: 'Неавторизирано: потребен е валиден админ токен.' })
      }
    }

    const email = String(req.get('x-admin-email') || req.body?.adminEmail || req.query?.adminEmail || '').trim().toLowerCase()

    // Во продукција (со ADMIN_TOKEN) е-поштата е задолжителна — инаку секој
    // со заедничкиот токен би бил третиран како Супер Админ.
    if (!email) {
      if (!config.adminToken) {
        req.adminRole = 'admin'
        req.adminEmail = null
        req.adminUserId = null
        return next()
      }
      return res.status(401).json({ error: 'Неавторизирано: недостасува админ е-пошта.' })
    }

    const { rows } = await query('SELECT id, email, role FROM users WHERE lower(email) = $1', [email])
    const user = rows[0]
    if (!user || !isAdminRole(user.role)) {
      return res.status(403).json({ error: 'Неавторизирано: потребна е администраторска сметка.' })
    }
    req.adminRole = user.role
    req.adminEmail = user.email
    req.adminUserId = user.id
    return next()
  } catch (err) {
    return next(err)
  }
}

export function requireSuperAdmin(req, res, next) {
  return requireAdmin(req, res, () => {
    if (!isSuperAdmin(req.adminRole)) {
      return res.status(403).json({ error: 'Само Супер Админ има пристап до оваа операција.' })
    }
    return next()
  })
}

export function requireEventApprover(req, res, next) {
  return requireAdmin(req, res, () => {
    if (!canApproveEvents(req.adminRole)) {
      return res.status(403).json({ error: 'Само Супер Админ може да одобрува настани.' })
    }
    return next()
  })
}

/** Проверка дали админот смее да работи со даден тип пријава. */
export function assertReportTypeAccess(req, res, type) {
  if (!canAccessReportType(req.adminRole, type)) {
    res.status(403).json({ error: 'Немате дозвола за овој тип на пријава.' })
    return false
  }
  return true
}
