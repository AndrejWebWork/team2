import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { config } from '../config.js'
import { query } from '../db.js'

export const authRouter = Router()

const LANGS = ['mk', 'en', 'sq']
const EMAIL_RE = /^\S+@\S+\.\S+$/

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

// POST /api/auth/register  { email, password, displayName?, language? }
// Креира нов корисник со bcrypt-хеширана лозинка. Враќа 409 ако е-поштата е зафатена.
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName = null, language = 'mk' } = req.body
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Внесете валидна е-пошта.' })
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Лозинката мора да има најмалку 6 карактери.' })
    }
    const lang = LANGS.includes(language) ? language : 'mk'

    const exists = await query('SELECT 1 FROM users WHERE email = $1', [email])
    if (exists.rowCount > 0) return res.status(409).json({ error: 'Веќе постои сметка со оваа е-пошта.' })

    const passwordHash = await bcrypt.hash(String(password), 10)
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, display_name, language, is_anonymous)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING id, email, role, display_name, language, points`,
      [email, passwordHash, displayName || String(email).split('@')[0], lang],
    )
    res.status(201).json(publicUser(rows[0]))
  } catch (err) { next(err) }
})

// POST /api/auth/login  { email, password }
// Проверува bcrypt лозинка. Враќа 401 при погрешни податоци (без да открива што).
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Недостасува е-пошта или лозинка.' })

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

    const ok = await bcrypt.compare(String(password), user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })

    // Админот по успешна најава со лозинка го добива админ токенот, потребен
    // за заштитените операции (менување статус, community корисници). Така
    // токенот не се вградува во јавниот frontend build.
    const payload = publicUser(user)
    if (user.role === 'admin' && config.adminToken) payload.adminToken = config.adminToken
    res.json(payload)
  } catch (err) { next(err) }
})

// DELETE /api/auth/account  { email, password }
// Трајно бришење на сметка (барање на Google Play/App Store). Лозинката се
// проверува за да не може некој друг да ја избрише сметката. Пријавите
// остануваат анонимизирани (reports.reporter_id → NULL преку ON DELETE SET NULL),
// а поените, токените за нотификации и потписите на настани се бришат каскадно.
authRouter.delete('/account', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Недостасува е-пошта или лозинка.' })

    const { rows } = await query(
      'SELECT id, role, password_hash FROM users WHERE email = $1',
      [email],
    )
    const user = rows[0]
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })

    const ok = await bcrypt.compare(String(password), user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })

    // Админ сметката не смее да се избрише самата себеси од апликацијата.
    if (user.role === 'admin') return res.status(403).json({ error: 'Админ сметката не може да се избрише од апликацијата.' })

    await query('DELETE FROM users WHERE id = $1', [user.id])
    res.json({ ok: true })
  } catch (err) { next(err) }
})
