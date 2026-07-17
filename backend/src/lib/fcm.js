import crypto from 'node:crypto'
import fs from 'node:fs'
import { config } from '../config.js'
import { query } from '../db.js'

// ============================================================================
// Праќање push нотификации преку Firebase Cloud Messaging — HTTP v1 API.
// (Стариот „legacy" API со сервер-клуч е исклучен од Google во јуни 2024.)
//
// Работи само ако е поставен FCM_SERVICE_ACCOUNT (env) — JSON од сервисен клуч
// на Firebase проектот (Project settings → Service accounts → Generate key).
// Може да биде или самиот JSON како стринг, или патека до .json фајлот.
// Ако не е поставен → тивко noop (само локалните нотификации работат).
// ============================================================================

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

let serviceAccount // undefined = уште не пробано, null = нема/неисправно
function loadServiceAccount() {
  if (serviceAccount !== undefined) return serviceAccount
  const raw = config.fcmServiceAccount
  if (!raw) { serviceAccount = null; return serviceAccount }
  try {
    const text = raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf8')
    const parsed = JSON.parse(text)
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      serviceAccount = null
    } else {
      serviceAccount = parsed
    }
  } catch {
    serviceAccount = null
  }
  return serviceAccount
}

export function isPushConfigured() {
  return Boolean(loadServiceAccount())
}

// ---- OAuth2 access token (кеширан, се обновува пред истек) ----
let cachedToken = null
let cachedTokenExp = 0

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

async function getAccessToken() {
  const acct = loadServiceAccount()
  if (!acct) return null
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && now < cachedTokenExp - 60) return cachedToken

  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: acct.client_email,
    scope: FCM_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64url(header)}.${base64url(claim)}`
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(acct.private_key, 'base64url')
  const assertion = `${unsigned}.${signature}`

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!res.ok) return null
  const data = await res.json()
  cachedToken = data.access_token
  cachedTokenExp = now + (data.expires_in || 3600)
  return cachedToken
}

// Дијагностика: потврдува дека клучот е валиден и Google издава access token.
// Враќа { configured, tokenOk, projectId }.
export async function verifyPush() {
  const acct = loadServiceAccount()
  if (!acct) return { configured: false, tokenOk: false, projectId: null }
  const token = await getAccessToken().catch(() => null)
  return { configured: true, tokenOk: Boolean(token), projectId: acct.project_id }
}

// FCM HTTP v1 бара сите data вредности да се стрингови.
function stringifyData(data = {}) {
  const out = {}
  for (const [k, v] of Object.entries(data)) out[k] = String(v)
  return out
}

// Праќа push до листа токени. Неуспесите се игнорираат (уредот е офлајн или
// токенот е застарен). Застарените токени се бришат од базата (404/UNREGISTERED).
export async function sendPushToTokens(tokens, { title, body, data = {} }) {
  const acct = loadServiceAccount()
  if (!acct || !Array.isArray(tokens) || tokens.length === 0) return
  const accessToken = await getAccessToken()
  if (!accessToken) return

  const url = `https://fcm.googleapis.com/v1/projects/${acct.project_id}/messages:send`
  await Promise.all(tokens.map(async (token) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token, notification: { title, body }, data: stringifyData(data) } }),
      })
      if (res.status === 404 || res.status === 400) {
        // Токенот повеќе не важи — исчисти го за да не праќаме залудно.
        await query('DELETE FROM device_tokens WHERE token = $1', [token]).catch(() => {})
      }
    } catch { /* мрежна грешка — игнорирај */ }
  }))
}

// Праќа push до сите уреди на даден корисник (по user_id).
export async function sendPushToUser(userId, payload) {
  if (!isPushConfigured() || !userId) return
  try {
    const { rows } = await query('SELECT token FROM device_tokens WHERE user_id = $1', [userId])
    await sendPushToTokens(rows.map((r) => r.token), payload)
  } catch { /* игнорирај */ }
}

// Праќа push до анонимен уред (по device_id од локалниот идентитет).
export async function sendPushToDevice(deviceId, payload) {
  if (!isPushConfigured() || !deviceId) return
  try {
    const { rows } = await query('SELECT token FROM device_tokens WHERE device_id = $1', [deviceId])
    await sendPushToTokens(rows.map((r) => r.token), payload)
  } catch { /* игнорирај */ }
}
