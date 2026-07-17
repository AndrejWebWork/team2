// Лозинката се хешира на уредот (SHA-256) пред да се испрати — никогаш plain text во payload.
// Backend чува bcrypt од овој хеш и го споредува при најава/регистрација.
export async function hashPasswordForTransit(password) {
  const data = new TextEncoder().encode(String(password))
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
