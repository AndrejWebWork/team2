import bcrypt from 'bcryptjs'
import { Router } from 'express'
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

    const { rows } = await query(
      'SELECT id, email, role, display_name, language, points, password_hash FROM users WHERE email = $1',
      [email],
    )
    const user = rows[0]
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })

    const ok = await bcrypt.compare(String(password), user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })

    res.json(publicUser(user))
  } catch (err) { next(err) }
})
