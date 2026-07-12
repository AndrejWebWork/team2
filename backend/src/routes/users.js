import bcrypt from 'bcryptjs'
import { Router } from 'express'
import { query } from '../db.js'
import { requireAdmin } from '../middleware/requireAdmin.js'

export const usersRouter = Router()

const LANGS = ['mk', 'en', 'sq']
const EMAIL_RE = /^\S+@\S+\.\S+$/

function publicCommunityUser(u) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    organizationName: u.organization_name,
    role: u.role,
    language: u.language,
    createdAt: u.created_at,
  }
}

// GET /api/users?email=...  → основни податоци + избран јазик
usersRouter.get('/', async (req, res, next) => {
  try {
    const email = req.query.email
    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    const { rows } = await query(
      'SELECT id, email, display_name, role, language, points FROM users WHERE email = $1',
      [email],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Корисникот не постои.' })
    res.json(rows[0])
  } catch (err) { next(err) }
})

// GET /api/users/community — листа на сите influencer/community корисници (само админ)
usersRouter.get('/community', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, email, display_name, organization_name, role, language, created_at
         FROM users WHERE role = 'organization' ORDER BY created_at DESC`,
    )
    res.json(rows.map(publicCommunityUser))
  } catch (err) { next(err) }
})

// POST /api/users/community  { email, displayName, organizationName?, password?, language? }
// Админ додава influencer/community корисник (улога 'organization') кој може да
// објавува акции. Ако корисникот веќе постои → го унапредува во 'organization'.
usersRouter.post('/community', requireAdmin, async (req, res, next) => {
  try {
    const { email, displayName = null, organizationName = null, password = null, language = 'mk' } = req.body
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Внесете валидна е-пошта.' })
    const lang = LANGS.includes(language) ? language : 'mk'
    const name = (displayName && String(displayName).trim()) || String(email).split('@')[0]

    const existing = await query('SELECT id FROM users WHERE email = $1', [email])

    if (existing.rows.length > 0) {
      // Постоечки корисник → унапреди во community; по желба смени лозинка.
      const passwordHash = password ? await bcrypt.hash(String(password), 10) : null
      const { rows } = await query(
        `UPDATE users SET
           role = 'organization',
           display_name = $2,
           organization_name = $3,
           is_anonymous = FALSE,
           notif_events = TRUE,
           password_hash = COALESCE($4, password_hash),
           updated_at = now()
         WHERE email = $1
         RETURNING id, email, display_name, organization_name, role, language, created_at`,
        [email, name, organizationName, passwordHash],
      )
      return res.json(publicCommunityUser(rows[0]))
    }

    // Нов корисник → мора да има лозинка за да може да се најави и објавува.
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'За нов корисник внесете лозинка (мин. 6 знаци).' })
    }
    const passwordHash = await bcrypt.hash(String(password), 10)
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, display_name, organization_name, role, language, is_anonymous, notif_events)
         VALUES ($1, $2, $3, $4, 'organization', $5, FALSE, TRUE)
       RETURNING id, email, display_name, organization_name, role, language, created_at`,
      [email, passwordHash, name, organizationName, lang],
    )
    res.status(201).json(publicCommunityUser(rows[0]))
  } catch (err) { next(err) }
})

// DELETE /api/users/community/:email — симни улога назад на обичен 'user' (само админ)
usersRouter.delete('/community/:email', requireAdmin, async (req, res, next) => {
  try {
    const email = req.params.email
    const { rows } = await query(
      `UPDATE users SET role = 'user', organization_name = NULL, updated_at = now()
         WHERE email = $1 AND role = 'organization'
       RETURNING id`,
      [email],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Community корисникот не постои.' })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// PATCH /api/users/language  { email, language } → зачувува избран јазик
// Прави upsert: ако корисникот не постои, го креира со тој јазик.
usersRouter.patch('/language', async (req, res, next) => {
  try {
    const { email, language } = req.body
    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    if (!LANGS.includes(language)) return res.status(400).json({ error: 'Невалиден јазик.' })
    const { rows } = await query(
      `INSERT INTO users (email, language)
         VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE
         SET language = EXCLUDED.language, updated_at = now()
       RETURNING id, email, display_name, role, language`,
      [email, language],
    )
    res.json(rows[0])
  } catch (err) { next(err) }
})
