import { Capacitor } from '@capacitor/core'

const VIEWPORT_BASE = 'width=device-width, initial-scale=1.0, viewport-fit=cover'

/**
 * iOS WKWebView (Capacitor): ако некој input има font < 16px, Safari зумира
 * при фокус и често ОСТАНУВА зумиран по blur/keyboard hide.
 * Ова го ресетира viewport-от по blur на форма елементи.
 */
export function installIosViewportZoomFix() {
  if (typeof document === 'undefined') return () => {}

  const isIosWebKit =
    Capacitor.getPlatform() === 'ios'
    || (/iP(hone|od|ad)/.test(navigator.userAgent) && /WebKit/.test(navigator.userAgent))

  if (!isIosWebKit) return () => {}

  let timer = null

  function resetViewport() {
    const meta = document.querySelector('meta[name="viewport"]')
    if (!meta) return
    // Краток maximum-scale=1 го турка WebView назад на 1.0, па враќаме чист meta.
    meta.setAttribute('content', `${VIEWPORT_BASE}, maximum-scale=1.0`)
    window.scrollTo(0, window.scrollY)
    requestAnimationFrame(() => {
      meta.setAttribute('content', VIEWPORT_BASE)
    })
  }

  function onFocusOut(e) {
    const t = e.target
    if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
    clearTimeout(timer)
    // Чекај keyboard dismiss анимација (~iOS 300ms).
    timer = setTimeout(resetViewport, 350)
  }

  function onVisibility() {
    if (!document.hidden) resetViewport()
  }

  document.addEventListener('focusout', onFocusOut, true)
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    clearTimeout(timer)
    document.removeEventListener('focusout', onFocusOut, true)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
