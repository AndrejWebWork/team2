// Бренд слики се вчитуваат еднаш преку Vite (хеширано име во build) — прелистувачот
// ги кешира долгорочно наместо да ги повикува /logo.png при секоја навигација.
import logoUrl from '../assets/logo.png'
import brandUrl from '../assets/skopje-brand.png'

export const LOGO_SRC = logoUrl
export const BRAND_SRC = brandUrl
