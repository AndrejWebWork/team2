// Нормализира Instagram tag (@, URL → username).
export function normalizeInstagramHandle(raw) {
  if (!raw) return ''
  let h = String(raw).trim()
  if (!h) return ''
  h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
  h = h.replace(/^@/, '').split(/[/?#]/)[0].trim()
  return h
}

export function instagramProfileUrl(handle) {
  const h = normalizeInstagramHandle(handle)
  return h ? `https://instagram.com/${h}` : null
}
