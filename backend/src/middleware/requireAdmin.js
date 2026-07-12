import { config } from '../config.js'

// Штити ги админ операциите (пр. менување статус на пријава).
// Клиентот испраќа `X-Admin-Token` заглавие што мора да се совпадне со ADMIN_TOKEN.
// Ако ADMIN_TOKEN не е поставен (локален развој), заштитата се прескокнува.
export function requireAdmin(req, res, next) {
  if (!config.adminToken) return next()
  const provided = req.get('x-admin-token') || ''
  if (provided && provided === config.adminToken) return next()
  return res.status(401).json({ error: 'Неавторизирано: потребен е валиден админ токен.' })
}
