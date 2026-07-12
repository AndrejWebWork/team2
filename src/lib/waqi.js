// Сервис за реално-временски податоци за квалитет на воздух преку WAQI (aqicn.org).
// Референтни податоци од Министерството за животна средина (МЖСПП), агрегирани од WAQI.
const WAQI_TOKEN = import.meta.env.VITE_WAQI_TOKEN
const API = 'https://api.waqi.info'

// Приближни граници на Скопскиот регион (југозапад -> североисток).
const SKOPJE_BOUNDS = '41.90,21.30,42.10,21.75'

// Убави македонски имиња за познатите МЖСПП станици.
const NAME_MK = {
  centar: 'Центар',
  'gazi baba': 'Гази Баба',
  karposh: 'Карпош',
  karpos: 'Карпош',
  lisice: 'Лисиче',
  rektorat: 'Ректорат',
  miladinovci: 'Миладиновци',
  'gjorche petrov': 'Ѓорче Петров',
  mobilegp: 'Мобилна станица — Ѓорче Петров',
}

// Стабилен клуч за превод по станица (сурово име -> i18n клуч `sensor.st.<key>`).
// Ако станицата не е позната, nameKey е null и се прикажува суровото име.
const NAME_KEY = {
  centar: 'centar',
  'gazi baba': 'gaziBaba',
  karposh: 'karpos',
  karpos: 'karpos',
  lisice: 'lisice',
  rektorat: 'rektorat',
  miladinovci: 'miladinovci',
  'gjorche petrov': 'gjorchePetrov',
  'nova international school skopje': 'nova',
  mobilegp: 'mobileGP',
}

// Дополнителни МЖСПП станици кои /map/bounds за Скопје НЕ ги враќа:
//  • 12408 Мобилна станица Ѓорче Петров — ВО Скопје, но WAQI не ја враќа во
//    bounds додека нема свежо мерење. Штом МЖСПП ја реактивира, автоматски
//    се појавува тука.
const EXTRA_UIDS = [12408]

// Мерење постаро од 48ч се смета за неактивна станица (не се прикажува).
const FRESH_MS = 48 * 60 * 60 * 1000

function nameKeyFor(raw) {
  const key = String(raw || '').split(',')[0].trim().toLowerCase()
  return NAME_KEY[key] || null
}

// Официјални референтни станици (МЖСПП). Сè друго што WAQI враќа во регионот
// се третира како НЕРЕФЕРЕНТЕН (граѓански/нискобуџетен) сензор — но сепак ЖИВО.
const REFERENT_KEYS = new Set(Object.keys(NAME_MK))

function categoryFor(rawName, uid) {
  // Приватните/граѓанските WAQI станици имаат негативен uid → секогаш нереферентни.
  if (Number(uid) < 0) return 'nonreferent'
  const key = String(rawName || '').split(',')[0].trim().toLowerCase()
  return REFERENT_KEYS.has(key) ? 'referent' : 'nonreferent'
}

function statusFromAqi(aqi) {
  if (aqi >= 101) return 'unhealthy'
  if (aqi >= 51) return 'moderate'
  return 'good'
}

// Го чисти името од WAQI ("Centar, Skopje, Macedonia (...)") во кратко читливо име.
function cleanName(raw) {
  const base = String(raw || '').split(',')[0].trim()
  const key = base.toLowerCase()
  return NAME_MK[key] || base || 'Непозната станица'
}

function toNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function getJson(url, signal) {
  // no-store: секогаш свежо од мрежата (никогаш кеширан одговор во прелистувачот),
  // за да добие корисникот тековно мерење при секое отворање/освежување.
  const res = await fetch(url, { signal, cache: 'no-store' })
  if (!res.ok) throw new Error(`WAQI HTTP ${res.status}`)
  const json = await res.json()
  if (json.status !== 'ok') throw new Error('WAQI status not ok')
  return json.data
}

// Детали за една станица (PM2.5, PM10, време на мерење + име/координати).
async function fetchStationDetail(uid, signal) {
  try {
    const d = await getJson(`${API}/feed/@${uid}/?token=${WAQI_TOKEN}`, signal)
    return {
      pm25: toNumber(d.iaqi?.pm25?.v),
      pm10: toNumber(d.iaqi?.pm10?.v),
      aqi: toNumber(d.aqi),
      updatedAt: d.time?.iso || null,
      name: d.city?.name || null,
      lat: toNumber(d.city?.geo?.[0]),
      lng: toNumber(d.city?.geo?.[1]),
    }
  } catch {
    return null
  }
}

// Дали мерењето е доволно свежо за прикажување (штити од „замрзнати" станици).
function isFresh(iso) {
  if (!iso) return false
  const t = Date.parse(iso)
  return Number.isFinite(t) && Date.now() - t < FRESH_MS
}

// Ги презема сите референтни (МЖСПП) станици во Скопје со податоци во живо.
// Враќа низа сензори во истиот облик како mock податоците.
export async function fetchSkopjeSensors(signal) {
  if (!WAQI_TOKEN) throw new Error('VITE_WAQI_TOKEN не е поставен')
  // networks=all ги вклучува и приватните/граѓанските WAQI станици (не само
  // официјалните МЖСПП). Пр. „NOVA International School Skopje“.
  const list = await getJson(
    `${API}/map/bounds/?token=${WAQI_TOKEN}&latlng=${SKOPJE_BOUNDS}&networks=all`,
    signal,
  )

  const stations = (Array.isArray(list) ? list : []).filter((s) => toNumber(s.uid) != null)

  // Дополнителни станици по uid (регионални МЖСПП + мобилна Ѓ. Петров),
  // само ако веќе не се вратени од bounds барањето.
  const boundsUids = new Set(stations.map((s) => Number(s.uid)))
  const extraUids = EXTRA_UIDS.filter((uid) => !boundsUids.has(uid))

  const [details, extraDetails] = await Promise.all([
    Promise.all(stations.map((s) => fetchStationDetail(s.uid, signal))),
    Promise.all(extraUids.map((uid) => fetchStationDetail(uid, signal))),
  ])

  const fromBounds = stations.map((s, i) => {
    const detail = details[i] || {}
    const aqi = detail.aqi ?? toNumber(s.aqi) ?? 0
    const name = cleanName(s.station?.name)
    const category = categoryFor(s.station?.name, s.uid)
    const referent = category === 'referent'
    return {
      id: `WAQI-${s.uid}`,
      name,
      nameKey: nameKeyFor(s.station?.name),
      area: name,
      aqi,
      pm25: detail.pm25 ?? null,
      pm10: detail.pm10 ?? null,
      status: statusFromAqi(aqi),
      lat: toNumber(s.lat),
      lng: toNumber(s.lon),
      category,
      source: referent ? 'МЖСПП (WAQI)' : 'Граѓански сензор (WAQI)',
      updatedAt: detail.updatedAt || null,
      sourceUrl: referent ? 'https://air.moepp.gov.mk/' : 'https://aqicn.org/',
    }
  })

  // Дополнителните станици се прикажуваат само со свежо мерење (<48ч) —
  // пр. мобилната Ѓ. Петров е неактивна од април и се прескокнува автоматски.
  const fromExtras = extraUids.map((uid, i) => {
    const d = extraDetails[i]
    if (!d || d.aqi == null || d.lat == null || d.lng == null || !isFresh(d.updatedAt)) return null
    const name = cleanName(d.name)
    const category = categoryFor(d.name, uid)
    const referent = category === 'referent'
    return {
      id: `WAQI-${uid}`,
      name,
      nameKey: nameKeyFor(d.name),
      area: name,
      aqi: d.aqi,
      pm25: d.pm25 ?? null,
      pm10: d.pm10 ?? null,
      status: statusFromAqi(d.aqi),
      lat: d.lat,
      lng: d.lng,
      category,
      source: referent ? 'МЖСПП (WAQI)' : 'Граѓански сензор (WAQI)',
      updatedAt: d.updatedAt || null,
      sourceUrl: referent ? 'https://air.moepp.gov.mk/' : 'https://aqicn.org/',
    }
  }).filter(Boolean)

  return [...fromBounds, ...fromExtras]
}
