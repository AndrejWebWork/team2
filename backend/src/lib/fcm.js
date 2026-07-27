import crypto from 'node:crypto'
import fs from 'node:fs'
import { config } from '../config.js'
import { query } from '../db.js'

// ============================================================================
// Праќање push нотификации преку Firebase Cloud Messaging — HTTP v1 API.
// Работи само ако е поставен FCM_SERVICE_ACCOUNT (env).
// ============================================================================

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
/** Мора да се совпаѓа со createChannel() на клиентот (Android 8+). */
export const PUSH_CHANNEL_ID = 'ekoskopje'

let serviceAccount // undefined = уште не пробано, null = нема/неисправно

function normalizePrivateKey(key) {
  if (typeof key !== 'string') return key
  // Vercel env често ги чува newline како литерал "\n".
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key
}

function parseServiceAccountRaw(raw) {
  let text = String(raw || '').trim()
  if (!text) return null
  // Ако е патека до фајл.
  if (!text.startsWith('{') && !text.startsWith('"')) {
    text = fs.readFileSync(text, 'utf8')
  }
  // Ако целиот JSON е завиткан како JSON-стринг.
  if (text.startsWith('"')) {
    text = JSON.parse(text)
  }
  const parsed = typeof text === 'string' ? JSON.parse(text) : text
  if (!parsed?.client_email || !parsed?.private_key || !parsed?.project_id) return null
  parsed.private_key = normalizePrivateKey(parsed.private_key)
  return parsed
}

function loadServiceAccount() {
  if (serviceAccount !== undefined) return serviceAccount
  try {
    serviceAccount = parseServiceAccountRaw(config.fcmServiceAccount)
  } catch {
    serviceAccount = null
  }
  return serviceAccount
}

export function isPushConfigured() {
  return Boolean(loadServiceAccount())
}

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

/** Дијагностика: { configured, tokenOk, projectId }. */
export async function verifyPush() {
  const acct = loadServiceAccount()
  if (!acct) return { configured: false, tokenOk: false, projectId: null }
  const token = await getAccessToken().catch(() => null)
  return { configured: true, tokenOk: Boolean(token), projectId: acct.project_id }
}

function stringifyData(data = {}) {
  const out = {}
  for (const [k, v] of Object.entries(data)) out[k] = String(v)
  return out
}

export async function sendPushToTokens(tokens, { title, body, data = {} }) {
  const acct = loadServiceAccount()
  if (!acct || !Array.isArray(tokens) || tokens.length === 0) return 0
  const accessToken = await getAccessToken()
  if (!accessToken) return 0

  const url = `https://fcm.googleapis.com/v1/projects/${acct.project_id}/messages:send`
  let ok = 0
  await Promise.all(tokens.map(async (token) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: stringifyData(data),
            android: {
              priority: 'HIGH',
              notification: {
                channel_id: PUSH_CHANNEL_ID,
                sound: 'default',
                default_vibrate_timings: true,
              },
            },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: { aps: { sound: 'default', 'content-available': 1 } },
            },
          },
        }),
      })
      if (res.ok) {
        ok += 1
        return
      }
      // Невалиден / одјавен токен — исчисти.
      if (res.status === 404 || res.status === 400) {
        const errBody = await res.text().catch(() => '')
        if (/UNREGISTERED|INVALID_ARGUMENT|NOT_FOUND/i.test(errBody) || res.status === 404) {
          await query('DELETE FROM device_tokens WHERE token = $1', [token]).catch(() => {})
        }
      }
    } catch { /* мрежна грешка */ }
  }))
  return ok
}

export async function sendPushToUser(userId, payload) {
  if (!isPushConfigured() || !userId) return 0
  try {
    const { rows } = await query('SELECT token FROM device_tokens WHERE user_id = $1', [userId])
    return await sendPushToTokens(rows.map((r) => r.token), payload)
  } catch {
    return 0
  }
}

export async function sendPushToDevice(deviceId, payload) {
  if (!isPushConfigured() || !deviceId) return 0
  try {
    const { rows } = await query('SELECT token FROM device_tokens WHERE device_id = $1', [deviceId])
    return await sendPushToTokens(rows.map((r) => r.token), payload)
  } catch {
    return 0
  }
}
