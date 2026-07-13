// Еднократно: ја пополнува општината за постоечки пријави без municipality,
// преку Nominatim reverse geocoding (1 барање/сек — почитување на политиката).
// Употреба: node scripts/backfillMunicipality.mjs "<DATABASE_URL>"
import pg from 'pg'

const conn = process.argv[2] || process.env.DATABASE_URL
if (!conn) { console.error('Missing DATABASE_URL'); process.exit(1) }

const pool = new pg.Pool({
  connectionString: conn,
  ssl: /neon\.tech|sslmode=require/.test(conn) ? { rejectUnauthorized: false } : undefined,
})

async function resolveMunicipality(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', Number(lat).toFixed(6))
  url.searchParams.set('lon', Number(lng).toFixed(6))
  url.searchParams.set('format', 'json')
  url.searchParams.set('zoom', '12')
  url.searchParams.set('accept-language', 'mk')
  const res = await fetch(url, { headers: { 'User-Agent': 'EkoSkopje-backfill/1.0' } })
  if (!res.ok) return ''
  const a = (await res.json()).address || {}
  const raw = a.municipality || a.city_district || a.suburb || a.town || a.city || a.village || ''
  return raw.replace(/^Општина\s+/i, '').trim()
}

const { rows } = await pool.query(
  `SELECT id, lat, lng FROM reports
   WHERE (municipality IS NULL OR municipality = '') AND lat IS NOT NULL AND lng IS NOT NULL`
)
console.log(`Reports to backfill: ${rows.length}`)

for (const r of rows) {
  try {
    const m = await resolveMunicipality(r.lat, r.lng)
    if (m) {
      await pool.query('UPDATE reports SET municipality = $1 WHERE id = $2', [m, r.id])
      console.log(`${r.id} -> ${m}`)
    } else {
      console.log(`${r.id} -> (not resolved)`)
    }
  } catch (e) {
    console.log(`${r.id} -> error: ${e.message}`)
  }
  await new Promise((ok) => setTimeout(ok, 1100))
}

await pool.end()
console.log('Done.')
