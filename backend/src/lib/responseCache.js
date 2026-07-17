import crypto from 'node:crypto'

// ============================================================================
// Кеш на JSON одговори во меморија — клучен за скалирање на голем број корисници
// (пр. 200.000 истовремено). Јавните GET одговори (пријави, лидерборд, настани)
// се ИСТИ за сите, па наместо да ја удираме базата илјадници пати во секунда, ги
// сервираме од меморија со краток TTL.
//
// Клучни својства:
//   • Single-flight: и при налет од илјадници истовремени барања, базата се
//     прашува САМО ЕДНАШ по клуч во еден TTL прозорец (спречува „thundering herd“).
//   • ETag + 304: ако клиентот има иста верзија (If-None-Match), враќаме празно
//     304 наместо целото тело — огромна заштеда на проток.
//   • Ограничена големина: за клучеви по корисник (пр. настани по email).
// ============================================================================

const store = new Map()      // key -> { body, etag, expires }
const inflight = new Map()   // key -> Promise<entry>
const MAX_ENTRIES = 5000

function evictIfNeeded() {
  if (store.size <= MAX_ENTRIES) return
  const now = Date.now()
  for (const [k, v] of store) {
    if (v.expires <= now) store.delete(k)
  }
  // Ако сè уште е преполн, исчисти го најстариот дел (Map чува редослед на вметнување).
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

async function computeEntry(key, ttlMs, producer) {
  if (!inflight.has(key)) {
    const p = (async () => {
      try {
        const data = await producer()
        const body = JSON.stringify(data)
        const etag = 'W/"' + crypto.createHash('sha1').update(body).digest('base64') + '"'
        const entry = { body, etag, expires: Date.now() + ttlMs }
        store.set(key, entry)
        evictIfNeeded()
        return entry
      } finally {
        inflight.delete(key)
      }
    })()
    inflight.set(key, p)
  }
  return inflight.get(key)
}

// Сервира кеширан JSON. `producer` (која ја прашува базата) се повикува најмногу
// еднаш по клуч во TTL прозорецот, дури и при масовна конкурентност.
export async function serveCachedJson(req, res, { key, ttlMs, producer }) {
  const now = Date.now()
  let entry = store.get(key)
  if (!entry || entry.expires <= now) {
    entry = await computeEntry(key, ttlMs, producer)
  }
  res.setHeader('ETag', entry.etag)
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
  const inm = req.headers['if-none-match']
  if (inm && inm === entry.etag) {
    return res.status(304).end()
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.status(200).send(entry.body)
}

// Ги брише сите кеш-записи чиј клуч почнува со дадениот префикс. Се повикува при
// запис (нова пријава, промена статус, нов настан…) за свежи податоци веднаш.
export function invalidateCache(prefix) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k)
  }
}

// На serverless (Vercel) секоја инстанца има посебен in-memory кеш — по PATCH на
// една инстанца, GET на друга може да врати застарени податоци. Затоа на Vercel
// секогаш читаме директно од база, со ETag само за клиентски 304.
export async function serveFreshJson(req, res, producer) {
  const data = await producer()
  const body = JSON.stringify(data)
  const etag = 'W/"' + crypto.createHash('sha1').update(body).digest('base64') + '"'
  res.setHeader('ETag', etag)
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate')
  const inm = req.headers['if-none-match']
  if (inm && inm === etag) return res.status(304).end()
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.status(200).send(body)
}
