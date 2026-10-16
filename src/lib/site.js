/** Официјален јавен origin — единствен извор за SEO, OG и надворешни UA. */
export const SITE_ORIGIN = 'https://ekoskopje.skopje.gov.mk'
export const SITE_NAME = 'Еко Скопје'
export const SITE_NAME_EN = 'Eko Skopje'
export const SITE_EMAIL = 'ekoskopje@skopje.gov.mk'
export const SITE_OPERATOR = 'Град Скопје'
export const SITE_LOGO = `${SITE_ORIGIN}/logo.png`
export const SITE_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`
export const SITE_LLMS = `${SITE_ORIGIN}/llms.txt`

export function siteUrl(path = '/') {
  if (!path || path === '/') return `${SITE_ORIGIN}/`
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}
