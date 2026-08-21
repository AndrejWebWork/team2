import { Router } from 'express'
import { query } from '../db.js'
import { extractClientPasswordHash, hashForStorage } from '../lib/clientPassword.js'
import { POINTS_PERIOD_SQL } from '../lib/pointsPeriod.js'
import { requireSuperAdmin } from '../middleware/requireAdmin.js'

export const usersRouter = Router()

const LANGS = ['mk', 'en', 'sq']
const EMAIL_RE = /^\S+@\S+\.\S+$/

function normalizeInstagramHandle(raw) {
  if (raw == null || raw === '') return null
  let h = String(raw).trim()
  if (!h) return null
  h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
  h = h.replace(/^@/, '').split(/[/?#]/)[0].trim()
  return h || null
}

function publicCommunityUser(u) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    organizationName: u.organization_name,
    instagramHandle: u.instagram_handle || null,
    role: u.role,
    language: u.language,
    createdAt: u.created_at,
  }
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    role: u.role,
    language: u.language,
    notif_air: u.notif_air,
    notif_waste: u.notif_waste,
    notif_events: u.notif_events,
    points: u.points ?? 0,
  }
}

// GET /api/users?email=...  → основни податоци + поставки
usersRouter.get('/', async (req, res, next) => {
  try {
    const email = req.query.email
    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    const { rows } = await query(
      `SELECT id, email, display_name, role, language,
              notif_air, notif_waste, notif_events,
              COALESCE((SELECT SUM(pe.points) FROM points_events pe
                        WHERE pe.user_id = users.id
                          AND ${POINTS_PERIOD_SQL}), 0)::int AS points
       FROM users WHERE email = $1`,
      [email],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Корисникот не постои.' })
    res.json(publicUser(rows[0]))
  } catch (err) { next(err) }
})

// GET /api/users/community — листа на сите influencer/community корисници (само Супер Админ)
usersRouter.get('/community', requireSuperAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, email, display_name, organization_name, instagram_handle, role, language, created_at
         FROM users WHERE role = 'organization' ORDER BY created_at DESC`,
    )
    res.json(rows.map(publicCommunityUser))
  } catch (err) { next(err) }
})

// POST /api/users/community  { email, displayName, organizationName?, passwordHash?, language? }
usersRouter.post('/community', requireSuperAdmin, async (req, res, next) => {
  try {
    const { email, displayName = null, organizationName = null, instagramHandle = null, language = 'mk' } = req.body
    const clientHash = extractClientPasswordHash(req.body)
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Внесете валидна е-пошта.' })
    const lang = LANGS.includes(language) ? language : 'mk'
    const name = (displayName && String(displayName).trim()) || String(email).split('@')[0]
    const instagram = normalizeInstagramHandle(instagramHandle)

    const existing = await query('SELECT id FROM users WHERE email = $1', [email])

    if (existing.rows.length > 0) {
      const passwordHash = clientHash ? await hashForStorage(clientHash) : null
      const { rows } = await query(
        `UPDATE users SET
           role = 'organization',
           display_name = $2,
           organization_name = $3,
           instagram_handle = $4,
           is_anonymous = FALSE,
           notif_events = TRUE,
           password_hash = COALESCE($5, password_hash),
           updated_at = now()
         WHERE email = $1
         RETURNING id, email, display_name, organization_name, instagram_handle, role, language, created_at`,
        [email, name, organizationName, instagram, passwordHash],
      )
      return res.json(publicCommunityUser(rows[0]))
    }

    // Нов корисник → мора да има лозинка (хеширана на клиентот) за да може да се најави.
    if (!clientHash) {
      return res.status(400).json({ error: 'За нов корисник внесете лозинка (мин. 6 знаци).' })
    }
    const storedHash = await hashForStorage(clientHash)
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, display_name, organization_name, instagram_handle, role, language, is_anonymous, notif_events)
         VALUES ($1, $2, $3, $4, $5, 'organization', $6, FALSE, TRUE)
       RETURNING id, email, display_name, organization_name, instagram_handle, role, language, created_at`,
      [email, storedHash, name, organizationName, instagram, lang],
    )
    res.status(201).json(publicCommunityUser(rows[0]))
  } catch (err) { next(err) }
})

// DELETE /api/users/community/:email — симни улога назад на обичен 'user' (само Супер Админ)
usersRouter.delete('/community/:email', requireSuperAdmin, async (req, res, next) => {
  try {
    const email = req.params.email
    const { rows } = await query(
      `UPDATE users SET role = 'user', organization_name = NULL, instagram_handle = NULL, updated_at = now()
         WHERE email = $1 AND role = 'organization'
       RETURNING id`,
      [email],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Community корисникот не постои.' })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

const SUBADMIN_ROLES = ['admin_inspection', 'admin_environment', 'admin_hygiene']
const SUBADMIN_DEFAULT_NAMES = {
  admin_inspection: 'Комунална инспекција',
  admin_environment: 'Животна средина инспекција',
  admin_hygiene: 'Комунална хигиена',
}

function publicSubAdmin(u) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    role: u.role,
    language: u.language,
    createdAt: u.created_at,
  }
}

// GET /api/users/subadmins — листа на подадмини (само Супер Админ)
usersRouter.get('/subadmins', requireSuperAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, email, display_name, role, language, created_at
         FROM users
        WHERE role::text = ANY($1::text[])
        ORDER BY role, created_at DESC`,
      [SUBADMIN_ROLES],
    )
    res.json(rows.map(publicSubAdmin))
  } catch (err) { next(err) }
})

// POST /api/users/subadmins — креирај / унапреди подадмин (само Супер Админ)
usersRouter.post('/subadmins', requireSuperAdmin, async (req, res, next) => {
  try {
    const { email, displayName = null, role, language = 'mk' } = req.body
    const clientHash = extractClientPasswordHash(req.body)
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Внесете валидна е-пошта.' })
    if (!SUBADMIN_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Невалидна улога на подадмин.' })
    }
    const lang = LANGS.includes(language) ? language : 'mk'
    const name = (displayName && String(displayName).trim())
      || SUBADMIN_DEFAULT_NAMES[role]
      || String(email).split('@')[0]

    const existing = await query('SELECT id, role FROM users WHERE lower(email) = $1', [String(email).toLowerCase()])
    if (existing.rows[0]?.role === 'admin') {
      return res.status(400).json({ error: 'Супер Админ сметката не може да се претвори во подадмин.' })
    }

    if (existing.rows.length > 0) {
      const passwordHash = clientHash ? await hashForStorage(clientHash) : null
      const { rows } = await query(
        `UPDATE users SET
           role = $2,
           display_name = $3,
           is_anonymous = FALSE,
           password_hash = COALESCE($4, password_hash),
           language = COALESCE($5, language),
           updated_at = now()
         WHERE lower(email) = $1
         RETURNING id, email, display_name, role, language, created_at`,
        [String(email).toLowerCase(), role, name, passwordHash, lang],
      )
      return res.json(publicSubAdmin(rows[0]))
    }

    if (!clientHash) {
      return res.status(400).json({ error: 'За нов подадмин внесете лозинка (мин. 6 знаци).' })
    }
    const storedHash = await hashForStorage(clientHash)
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, display_name, role, language, is_anonymous)
         VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING id, email, display_name, role, language, created_at`,
      [String(email).toLowerCase(), storedHash, name, role, lang],
    )
    res.status(201).json(publicSubAdmin(rows[0]))
  } catch (err) { next(err) }
})

// DELETE /api/users/subadmins/:email — симни подадмин улога назад на 'user'
usersRouter.delete('/subadmins/:email', requireSuperAdmin, async (req, res, next) => {
  try {
    const email = String(req.params.email || '').trim().toLowerCase()
    const { rows } = await query(
      `UPDATE users SET role = 'user', updated_at = now()
         WHERE lower(email) = $1 AND role::text = ANY($2::text[])
       RETURNING id`,
      [email, SUBADMIN_ROLES],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Подадминот не постои.' })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// PATCH /api/users/settings  { email, displayName?, language?, notifAir?, notifWaste?, notifEvents? }
// Зачувување на профил и поставки (како јазикот) — делумно ажурирање по поле.
usersRouter.patch('/settings', async (req, res, next) => {
  try {
    const {
      email,
      displayName,
      language,
      notifAir,
      notifWaste,
      notifEvents,
    } = req.body
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Недостасува или е невалидна е-пошта.' })

    const sets = []
    const vals = [email]
    let i = 2

    if (displayName !== undefined) {
      const name = String(displayName).trim()
      if (!name) return res.status(400).json({ error: 'Прикажаното име не смее да биде празно.' })
      sets.push(`display_name = $${i++}`)
      vals.push(name)
    }
    if (language !== undefined) {
      if (!LANGS.includes(language)) return res.status(400).json({ error: 'Невалиден јазик.' })
      sets.push(`language = $${i++}`)
      vals.push(language)
    }
    if (notifAir !== undefined) {
      sets.push(`notif_air = $${i++}`)
      vals.push(Boolean(notifAir))
    }
    if (notifWaste !== undefined) {
      sets.push(`notif_waste = $${i++}`)
      vals.push(Boolean(notifWaste))
    }
    if (notifEvents !== undefined) {
      sets.push(`notif_events = $${i++}`)
      vals.push(Boolean(notifEvents))
    }

    if (sets.length === 0) return res.status(400).json({ error: 'Нема полиња за ажурирање.' })

    const { rows } = await query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = now()
         WHERE email = $1
       RETURNING id, email, display_name, role, language, notif_air, notif_waste, notif_events`,
      vals,
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Корисникот не постои.' })
    res.json(publicUser(rows[0]))
  } catch (err) { next(err) }
})

// PATCH /api/users/language  { email, language } → зачувува избран јазик (задржано за компатибилност)
usersRouter.patch('/language', async (req, res, next) => {
  try {
    const { email, language } = req.body
    if (!email) return res.status(400).json({ error: 'Недостасува email.' })
    if (!LANGS.includes(language)) return res.status(400).json({ error: 'Невалиден јазик.' })
    const { rows } = await query(
      `UPDATE users SET language = $2, updated_at = now()
         WHERE email = $1
       RETURNING id, email, display_name, role, language, notif_air, notif_waste, notif_events`,
      [email, language],
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Корисникот не постои.' })
    res.json(publicUser(rows[0]))
  } catch (err) { next(err) }
})
