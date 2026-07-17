import bcrypt from 'bcryptjs'

const HEX_RE = /^[a-f0-9]{64}$/i

export function normalizeClientPasswordHash(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return HEX_RE.test(trimmed) ? trimmed : null
}

export function extractClientPasswordHash(body) {
  return normalizeClientPasswordHash(body?.passwordHash ?? body?.password)
}

export async function hashForStorage(clientPasswordHash) {
  return bcrypt.hash(clientPasswordHash, 10)
}

export async function verifyClientPassword(clientPasswordHash, storedBcryptHash) {
  const normalized = normalizeClientPasswordHash(clientPasswordHash)
  if (!normalized || !storedBcryptHash) return false
  return bcrypt.compare(normalized, storedBcryptHash)
}
