import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { SITE_LLMS, SITE_NAME, SITE_OG_IMAGE, SITE_ORIGIN, siteUrl } from '../lib/site'

const NOINDEX = new Set([
  '/admin-panel',
  '/admin-desk',
  '/admin-community',
  '/auth-loading',
  '/reset-password',
  '/forgot-password',
  '/notifications',
])

const PAGE_SEO = {
  mk: {
    '/home': {
      title: `${SITE_NAME} — пријави еко проблем во Скопје`,
      description: 'Еко Скопје, eko skopje, еко скопје: официјална платформа на Град Скопје. Пријави дива депонија, контејнер или миризба со GPS и фотографија. Следи го статусот јавно.',
    },
    '/air': {
      title: `${SITE_NAME} — квалитет на воздух во Скопје во живо`,
      description: 'Еко Скопје (eko skopje): AQI, PM2.5 и PM10 од референтни станици на МЖСПП и информативни граѓански сензори. Карта на Скопје во реално време.',
    },
    '/waste': {
      title: `${SITE_NAME} — диви депонии во Скопје`,
      description: 'Еко Скопје (eko skopje): преглед на пријавени диви депонии, статус на постапување и мапа на случаи во Град Скопје.',
    },
    '/containers': {
      title: `${SITE_NAME} — контејнери и совети за отпад`,
      description: 'Еко Скопје (eko skopje): пријави преполн или неисправен контејнер и прочитај како правилно да се чуваат контејнерите во Скопје.',
    },
    '/community': {
      title: `${SITE_NAME} — еко заедница и акции`,
      description: 'Еко настани и граѓански акции одобрени од Град Скопје. Пријави се и освојувај поени.',
    },
    '/leaderboard': {
      title: `${SITE_NAME} — листа на поени`,
      description: 'Јавна ранг-листа: поени за пријави, решени случаи и учество во еко акции во Скопје.',
    },
    '/impressum': {
      title: `${SITE_NAME} — импресум`,
      description: 'Оператор Град Скопје. За проектот Еко Скопје, креаторите и SkopYEAH! Inokamp.',
    },
    '/legal': {
      title: `${SITE_NAME} — политика за приватност и услови`,
      description: 'Приватност, услови за користење и извори на податоци за веб, Android и iOS апликацијата Еко Скопје.',
    },
    '/login': {
      title: `${SITE_NAME} — најава`,
      description: 'Најави се во Еко Скопје за да ги следиш пријавите, поените и еко акциите.',
    },
    '/settings': {
      title: `${SITE_NAME} — поставки`,
      description: 'Јазик, известувања, сметка и правни информации на Еко Скопје.',
    },
  },
  en: {
    '/home': { title: `${SITE_NAME} — report an environmental issue in Skopje`, description: 'Eko Skopje (eko skopje, ekoskopje): official City of Skopje platform. Report illegal dumps, containers or air smell with GPS and photos. Track status in public.' },
    '/air': { title: `${SITE_NAME} — live air quality in Skopje`, description: 'AQI, PM2.5 and PM10 from MoEPP reference stations and informational civic sensors. Real-time Skopje map.' },
    '/waste': { title: `${SITE_NAME} — illegal dumps in Skopje`, description: 'Open illegal-dump reports, case status and a city-wide map for Skopje.' },
    '/containers': { title: `${SITE_NAME} — waste containers`, description: 'Report a full or broken container and read how to keep bins in good condition.' },
    '/community': { title: `${SITE_NAME} — community eco actions`, description: 'City-approved eco events in Skopje. Sign up and earn points.' },
    '/leaderboard': { title: `${SITE_NAME} — points leaderboard`, description: 'Public ranking for reports, resolved cases and eco-action participation.' },
    '/impressum': { title: `${SITE_NAME} — impressum`, description: 'Operated by the City of Skopje. About Еко Скопје, creators and SkopYEAH! Inokamp.' },
    '/legal': { title: `${SITE_NAME} — privacy and terms`, description: 'Privacy policy, terms of use and data sources for the web, Android and iOS app.' },
    '/login': { title: `${SITE_NAME} — sign in`, description: 'Sign in to track reports, points and eco events.' },
    '/settings': { title: `${SITE_NAME} — settings`, description: 'Language, notifications, account and legal information.' },
  },
  sq: {
    '/home': { title: `${SITE_NAME} — raporto problem mjedisor në Shkup`, description: 'Platforma zyrtare e Qytetit të Shkupit. Raporto deponi, kontejnerë ose erë me GPS dhe foto.' },
    '/air': { title: `${SITE_NAME} — cilësia e ajrit në Shkup`, description: 'AQI, PM2.5 dhe PM10 nga stacionet referente MMJPH dhe sensorë qytetarë informativë.' },
    '/waste': { title: `${SITE_NAME} — deponi ilegale në Shkup`, description: 'Raportet e deponive ilegale, statusi i rastit dhe harta e qytetit.' },
    '/containers': { title: `${SITE_NAME} — kontejnerët e mbeturinave`, description: 'Raporto kontejner të mbushur ose të dëmtuar dhe lexo këshillat e kujdesit.' },
    '/community': { title: `${SITE_NAME} — komuniteti ekologjik`, description: 'Ngjarje ekologjike të miratuara nga Qyteti i Shkupit.' },
    '/leaderboard': { title: `${SITE_NAME} — tabela e pikëve`, description: 'Renditja publike për raporte, raste të zgjidhura dhe aksione.' },
    '/impressum': { title: `${SITE_NAME} — impresum`, description: 'Operatori: Qyteti i Shkupit. Rreth Еко Скопје dhe SkopYEAH! Inokamp.' },
    '/legal': { title: `${SITE_NAME} — privatësia dhe kushtet`, description: 'Politika e privatësisë, kushtet e përdorimit dhe burimet e të dhënave.' },
    '/login': { title: `${SITE_NAME} — kyçu`, description: 'Kyçuni për të ndjekur raportet, pikët dhe ngjarjet.' },
    '/settings': { title: `${SITE_NAME} — cilësimet`, description: 'Gjuha, njoftimet, llogaria dhe informacioni ligjor.' },
  },
}

const DEFAULT = {
  mk: {
    title: `${SITE_NAME} — официјална еко платформа на Град Скопје`,
    description: 'Еко Скопје (ekoskopje, eko skopje, еко скопје) е официјалната платформа на Град Скопје: квалитет на воздух во живо, пријавување диви депонии и контејнери, следење на статус и еко акции.',
  },
  en: {
    title: `${SITE_NAME} — official eco platform of the City of Skopje`,
    description: 'Eko Skopje (eko skopje, ekoskopje, еко скопје): live air quality, illegal-dump and container reports, public status tracking and eco actions. Operator: City of Skopje.',
  },
  sq: {
    title: `${SITE_NAME} — platforma zyrtare ekologjike e Qytetit të Shkupit`,
    description: 'Cilësia e ajrit, raporte për deponi dhe kontejnerë, status publik dhe aksione. Operatori: Qyteti i Shkupit.',
  },
}

const CRUMB = {
  mk: { home: 'Почетна', air: 'Воздух', waste: 'Диви депонии', containers: 'Контејнери', community: 'Заедница', leaderboard: 'Лидерборд', impressum: 'Импресум', legal: 'Правни информации', login: 'Најава', settings: 'Поставки' },
  en: { home: 'Home', air: 'Air', waste: 'Illegal dumps', containers: 'Containers', community: 'Community', leaderboard: 'Leaderboard', impressum: 'Impressum', legal: 'Legal', login: 'Sign in', settings: 'Settings' },
  sq: { home: 'Ballina', air: 'Ajri', waste: 'Deponi', containers: 'Kontejnerë', community: 'Komuniteti', leaderboard: 'Tabela', impressum: 'Impresum', legal: 'Ligjore', login: 'Kyçu', settings: 'Cilësimet' },
}

function upsertMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${CSS.escape(key)}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel, href, extra = {}) {
  const sel = extra.hreflang
    ? `link[rel="${rel}"][hreflang="${extra.hreflang}"]`
    : `link[rel="${rel}"]`
  let el = document.head.querySelector(sel)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    if (extra.hreflang) el.setAttribute('hreflang', extra.hreflang)
    if (extra.type) el.setAttribute('type', extra.type)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertJsonLd(id, data) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function pagePath(pathname) {
  if (pathname === '/' || !pathname) return '/'
  return pathname
}

/** Динамички title, canonical, OG и JSON-LD по патека + јазик. */
export function SeoHead() {
  const { pathname, search } = useLocation()
  const { language } = useApp()
  const lang = PAGE_SEO[language] ? language : 'mk'

  useEffect(() => {
    const path = pagePath(pathname)
    const page = PAGE_SEO[lang]?.[path] || DEFAULT[lang] || DEFAULT.mk
    const url = siteUrl(path === '/' ? '/' : path)
    const indexable = !NOINDEX.has(path)

    document.title = page.title
    document.documentElement.lang = lang === 'sq' ? 'sq' : lang

    upsertMeta('name', 'description', page.description)
    upsertMeta('name', 'keywords', 'ekoskopje, eko skopje, еко скопје, Еко Скопје, Eko Skopje, EkoSkopje, ЕкоСкопје, Град Скопје, ekoskopje.skopje.gov.mk')
    upsertMeta('name', 'robots', indexable
      ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
      : 'noindex, nofollow')
    upsertMeta('name', 'googlebot', indexable ? 'index, follow' : 'noindex, nofollow')
    upsertMeta('property', 'og:title', page.title)
    upsertMeta('property', 'og:description', page.description)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:image', SITE_OG_IMAGE)
    upsertMeta('property', 'og:locale', lang === 'en' ? 'en_US' : lang === 'sq' ? 'sq_AL' : 'mk_MK')
    upsertMeta('name', 'twitter:title', page.title)
    upsertMeta('name', 'twitter:description', page.description)
    upsertMeta('name', 'twitter:image', SITE_OG_IMAGE)

    upsertLink('canonical', url)
    upsertLink('describedby', SITE_LLMS, { type: 'text/plain' })

    const crumbLabels = CRUMB[lang] || CRUMB.mk
    const slug = path.replace(/^\//, '')
    const crumbs = [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_ORIGIN}/` },
    ]
    if (slug && crumbLabels[slug]) {
      crumbs.push({ '@type': 'ListItem', position: 2, name: crumbLabels[slug], item: url })
    }
    upsertJsonLd('seo-breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs,
    })
    upsertJsonLd('seo-webpage', {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${url}#page`,
      url,
      name: page.title,
      description: page.description,
      alternateName: ['ekoskopje', 'eko skopje', 'еко скопје', 'Eko Skopje', 'EkoSkopje', 'ЕкоСкопје'],
      disambiguatingDescription: 'Official City of Skopje eco platform at ekoskopje.skopje.gov.mk. Not the NGO Eko-svest.',
      inLanguage: lang,
      isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
      about: { '@id': `${SITE_ORIGIN}/#org` },
      publisher: { '@id': `${SITE_ORIGIN}/#city` },
    })
  }, [pathname, search, lang])

  return null
}
