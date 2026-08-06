import crypto from 'node:crypto'
import { Router } from 'express'
import { config } from '../config.js'
import { query } from '../db.js'
import { extractClientPasswordHash, hashForStorage, verifyClientPassword } from '../lib/clientPassword.js'
import { isEmailConfigured, sendPasswordResetEmail } from '../lib/brevo.js'
import { isAdminRole } from '../lib/roles.js'

export const authRouter = Router()

const LANGS = ['mk', 'en', 'sq']
const EMAIL_RE = /^\S+@\S+\.\S+$/
const RESET_TTL_MS = 60 * 60 * 1000
const RESET_OK_MSG = 'Испративме линк за ресетирање на вашата е-пошта.'

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function generateResetToken() {
  return crypto.randomBytes(32).toString('hex')
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    displayName: u.display_name,
    language: u.language,
    points: u.points ?? 0,
  }
}

// POST /api/auth/register  { email, passwordHash, displayName?, language? }
// passwordHash = SHA-256 од лозинката (хеширано на клиентот). Backend чува bcrypt(passwordHash).
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, displayName = null, language = 'mk' } = req.body
    const passwordHash = extractClientPasswordHash(req.body)
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Внесете валидна е-пошта.' })
    if (!passwordHash) {
      return res.status(400).json({ error: 'Невалиден формат на лозинката. Ажурирајте ја апликацијата и обидете се повторно.' })
    }
    const lang = LANGS.includes(language) ? language : 'mk'

    const exists = await query('SELECT 1 FROM users WHERE email = $1', [email])
    if (exists.rowCount > 0) return res.status(409).json({ error: 'Веќе постои сметка со оваа е-пошта.' })

    const storedHash = await hashForStorage(passwordHash)
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, display_name, language, is_anonymous)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id, email, role, display_name, language, points`,
      [email, storedHash, displayName || String(email).split('@')[0], lang],
    )
    res.status(201).json(publicUser(rows[0]))
  } catch (err) { next(err) }
})

// POST /api/auth/login  { email, passwordHash }
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email } = req.body
    const passwordHash = extractClientPasswordHash(req.body)
    if (!email || !passwordHash) return res.status(400).json({ error: 'Недостасува е-пошта или лозинка.' })

    // Поените се МЕСЕЧНИ (се ресетираат на 1-ви секој месец) — се сумираат
    // од points_events за тековниот месец, исто како leaderboard_monthly.
    const { rows } = await query(
      `SELECT id, email, role, display_name, language, password_hash,
              COALESCE((SELECT SUM(pe.points) FROM points_events pe
                        WHERE pe.user_id = users.id
                          AND pe.created_at >= date_trunc('month', now())), 0) AS points
       FROM users WHERE email = $1`,
      [email],
    )
    const user = rows[0]
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })

    const ok = await verifyClientPassword(passwordHash, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })

    // Админот по успешна најава со лозинка го добива админ токенот, потребен
    // за заштитените операции (менување статус, community корисници). Така
    // токенот не се вградува во јавниот frontend build.
    const payload = publicUser(user)
    if (isAdminRole(user.role) && config.adminToken) payload.adminToken = config.adminToken
    res.json(payload)
  } catch (err) { next(err) }
})

// POST /api/auth/forgot-password  { email, language? }
// language = јазикот избран во апликацијата (mk|en|sq); fallback = users.language.
authRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    const requestedLang = String(req.body?.language || '').trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Внесете валидна е-пошта.' })
    }
    if (!isEmailConfigured()) {
      return res.status(503).json({ error: 'Email сервисот не е конфигуриран. Обратете се до администраторот.' })
    }

    const { rows } = await query(
      `SELECT id, email, language, password_hash
       FROM users
       WHERE email = $1 AND is_anonymous = FALSE`,
      [email],
    )
    const user = rows[0]
    if (!user) {
      return res.status(404).json({ error: 'Нема регистрирана сметка со оваа е-пошта.' })
    }
    if (!user.password_hash) {
      return res.status(400).json({ error: 'Оваа сметка не користи лозинка.' })
    }

    const token = generateResetToken()
    const tokenHash = hashResetToken(token)
    const expiresAt = new Date(Date.now() + RESET_TTL_MS)

    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id])
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt],
    )

    const resetUrl = `${config.appPublicUrl}/reset-password?token=${encodeURIComponent(token)}`
    const language = LANGS.includes(requestedLang)
      ? requestedLang
      : (LANGS.includes(user.language) ? user.language : 'mk')
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
      language,
    })

    res.json({ ok: true, message: RESET_OK_MSG })
  } catch (err) { next(err) }
})

// POST /api/auth/reset-password  { token, passwordHash }
authRouter.post('/reset-password', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim()
    const passwordHash = extractClientPasswordHash(req.body)
    if (!token || token.length < 32) {
      return res.status(400).json({ error: 'Невалиден или истечен линк за ресетирање.' })
    }
    if (!passwordHash) {
      return res.status(400).json({ error: 'Невалиден формат на лозинката. Ажурирајте ја апликацијата и обидете се повторно.' })
    }

    const tokenHash = hashResetToken(token)
    const { rows } = await query(
      `SELECT prt.id, prt.user_id, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1 AND prt.expires_at > now()`,
      [tokenHash],
    )
    const row = rows[0]
    if (!row) {
      return res.status(400).json({ error: 'Невалиден или истечен линк за ресетирање.' })
    }

    const storedHash = await hashForStorage(passwordHash)
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [storedHash, row.user_id])
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [row.user_id])

    res.json({ ok: true, message: 'Лозинката е успешно променета. Сега можете да се најавите.' })
  } catch (err) { next(err) }
})

// DELETE /api/auth/account  { email, passwordHash }
authRouter.delete('/account', async (req, res, next) => {
  try {
    const { email } = req.body
    const passwordHash = extractClientPasswordHash(req.body)
    if (!email || !passwordHash) return res.status(400).json({ error: 'Недостасува е-пошта или лозинка.' })

    const { rows } = await query(
      'SELECT id, role, password_hash FROM users WHERE email = $1',
      [email],
    )
    const user = rows[0]
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })

    const ok = await verifyClientPassword(passwordHash, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })

    // Админ сметките не смеат да се бришат од апликацијата.
    if (isAdminRole(user.role)) return res.status(403).json({ error: 'Админ сметката не може да се избрише од апликацијата.' })

    await query('DELETE FROM users WHERE id = $1', [user.id])
    res.json({ ok: true })
  } catch (err) { next(err) }
})
