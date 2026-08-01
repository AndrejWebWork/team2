import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const SITE = 'https://team2-zeta.vercel.app'
const BRAND = 'Еко Скопје'

const PAGE_SEO = {
  mk: {
    '/home': {
      title: `${BRAND} — пријави проблем`,
      description: 'Пријави дива депонија, преполн контејнер или миризба. Локацијата се снима автоматски.',
    },
    '/air': {
      title: `${BRAND} — квалитет на воздух`,
      description: 'Реални мерења од референтни МЖСПП сензори и информативни граѓански сензори во Скопје.',
    },
    '/waste': {
      title: `${BRAND} — диви депонии`,
      description: 'Преглед и следење на пријави за диви депонии во Скопје.',
    },
    '/containers': {
      title: `${BRAND} — контејнери`,
      description: 'Пријави и статус за преполни или неисправни контејнери.',
    },
    '/community': {
      title: `${BRAND} — заедница`,
      description: 'Еко-акции и настани за почисто Скопје.',
    },
    '/leaderboard': {
      title: `${BRAND} — лидерборд`,
      description: 'Како се освојуваат поени: пријави, решени случаи и еко-акции.',
    },
    '/impressum': {
      title: `${BRAND} — импресум`,
      description: 'За проектот Еко Скопје, креаторите и SkopYEAH! Inokamp.',
    },
    '/legal': {
      title: `${BRAND} — правни информации`,
      description: 'Политика на приватност, колачиња и правни информации за Еко Скопје.',
    },
    '/login': {
      title: `${BRAND} — најава`,
      description: 'Најави се за да ги следиш пријавите и поените.',
    },
  },
  en: {
    '/home': { title: `${BRAND} — report an issue`, description: 'Report illegal dumps, overflowing containers or smell issues in Skopje.' },
    '/air': { title: `${BRAND} — air quality`, description: 'Live air quality from MoEPP reference stations and civic sensors in Skopje.' },
    '/waste': { title: `${BRAND} — illegal dumps`, description: 'Track illegal dump reports across Skopje.' },
    '/containers': { title: `${BRAND} — containers`, description: 'Report and track overflowing or broken waste containers.' },
    '/community': { title: `${BRAND} — community`, description: 'Eco actions and events for a cleaner Skopje.' },
    '/leaderboard': { title: `${BRAND} — leaderboard`, description: 'How points are earned: reports, resolved cases and eco actions.' },
    '/impressum': { title: `${BRAND} — impressum`, description: 'About Еко Скопје, creators and SkopYEAH! Inokamp.' },
    '/legal': { title: `${BRAND} — legal`, description: 'Privacy, cookies and legal information.' },
    '/login': { title: `${BRAND} — sign in`, description: 'Sign in to track your reports and points.' },
  },
  sq: {
    '/home': { title: `${BRAND} — raporto problem`, description: 'Raporto deponi ilegale, kontejnerë të mbushur ose erë në Shkup.' },
    '/air': { title: `${BRAND} — cilësia e ajrit`, description: 'Matje në kohë reale nga stacionet referente MMJPH dhe sensorë qytetarë.' },
    '/waste': { title: `${BRAND} — deponi`, description: 'Ndjekja e raporteve për deponi ilegale në Shkup.' },
    '/containers': { title: `${BRAND} — kontejnerë`, description: 'Raporto dhe ndiq kontejnerët e mbushur ose të dëmtuar.' },
    '/community': { title: `${BRAND} — komuniteti`, description: 'Aksione ekologjike dhe ngjarje për Shkup më të pastër.' },
    '/leaderboard': { title: `${BRAND} — tabela e liderëve`, description: 'Si fitohen pikët: raporte, raste të zgjidhura dhe aksione.' },
    '/impressum': { title: `${BRAND} — impresum`, description: 'Rreth Еко Скопје, krijuesve dhe SkopYEAH! Inokamp.' },
    '/legal': { title: `${BRAND} — ligjore`, description: 'Privatësia, cookies dhe informacione ligjore.' },
    '/login': { title: `${BRAND} — kyçu`, description: 'Kyçuni për të ndjekur raportet dhe pikët.' },
  },
}

const DEFAULT = {
  mk: {
    title: `${BRAND} — квалитет на воздух, диви депонии и контејнери во Скопје`,
    description: 'Граѓанска еко-платформа за Град Скопје: воздух во живо, пријави и еко-акции.',
  },
  en: {
    title: `${BRAND} — air quality, dumps and containers in Skopje`,
    description: 'Civic eco platform for Skopje: live air, reports and community actions.',
  },
  sq: {
    title: `${BRAND} — cilësia e ajrit, deponi dhe kontejnerë në Shkup`,
    description: 'Platformë qytetare ekologjike për Shkupin: ajër, raporte dhe aksione.',
  },
}

function upsertMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/** Динамички title/description по патека + јазик (SEO + AI snippets). */
export function SeoHead() {
  const { pathname } = useLocation()
  const { language } = useApp()
  const lang = PAGE_SEO[language] ? language : 'mk'

  useEffect(() => {
    const page = PAGE_SEO[lang]?.[pathname] || DEFAULT[lang] || DEFAULT.mk
    document.title = page.title
    document.documentElement.lang = lang === 'sq' ? 'sq' : lang

    upsertMeta('name', 'description', page.description)
    upsertMeta('property', 'og:title', page.title)
    upsertMeta('property', 'og:description', page.description)
    upsertMeta('property', 'og:url', `${SITE}${pathname === '/' ? '/' : pathname}`)
    upsertMeta('name', 'twitter:title', page.title)
    upsertMeta('name', 'twitter:description', page.description)

    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', `${SITE}${pathname === '/' ? '/' : pathname}`)
  }, [pathname, lang])

  return null
}
