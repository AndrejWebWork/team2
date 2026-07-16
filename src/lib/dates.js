// Помошни функции за датуми — DD/MM/YYYY за приказ, YYYY-MM-DD за API/база.

/** Локален датум YYYY-MM-DD (без UTC поместување). */
export function todayIso() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

/** ISO (YYYY-MM-DD) → DD/MM/YYYY за приказ. */
export function formatDisplayDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** DD/MM/YYYY или DD.MM.YYYY → ISO (YYYY-MM-DD), или null ако е невалидно. */
export function parseDisplayDate(display) {
  const raw = String(display || '').trim()
  const m = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) return null
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const check = new Date(iso)
  if (Number.isNaN(check.getTime())) return null
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null
  return iso
}

/** Дали ISO датумот е денес или во иднина. */
export function isTodayOrFuture(iso) {
  return Boolean(iso && iso >= todayIso())
}

/** Авто-форматирање при пишување: само цифри → DD/MM/YYYY. */
export function maskDisplayDateInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}
