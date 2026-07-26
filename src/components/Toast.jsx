import { AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function Toast({ toast, onClose }) {
  // `show` controls mount + enter animation; `leaving` triggers the exit slide.
  const [show, setShow] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const closeTimer = useRef(null)
  const exitTimer = useRef(null)

  useEffect(() => {
    clearTimeout(closeTimer.current)
    clearTimeout(exitTimer.current)
    if (!toast) {
      setShow(false)
      setLeaving(false)
      return undefined
    }
    setShow(true)
    setLeaving(false)
    // Автоматско затворање: прво пушти го излезот, па извести го родителот.
    closeTimer.current = setTimeout(() => {
      setLeaving(true)
      exitTimer.current = setTimeout(() => onClose(), 280)
    }, 2600)
    return () => {
      clearTimeout(closeTimer.current)
      clearTimeout(exitTimer.current)
    }
  }, [toast, onClose])

  if (!toast || !show) return null

  function dismiss() {
    setLeaving(true)
    clearTimeout(closeTimer.current)
    exitTimer.current = setTimeout(() => onClose(), 280)
  }

  // ПОРТАЛ во <body>: страниците имаат transform/анимации (page transitions,
  // stagger), а transform на родител го „заробува" position:fixed да се однесува
  // како absolute (се движи со содржината при скрол). Рендерирано директно во
  // body, fixed е закачен за ЕКРАНОТ на секој уред — при скрол останува на исто
  // место долу-десно, додека сам не исчезне.
  return createPortal(
    <div className='pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[1300] flex justify-end sm:inset-x-auto sm:right-4 lg:bottom-3'>
      <div
        role='status'
        aria-live='polite'
        onClick={dismiss}
        className={`${leaving ? 'toast-exit' : 'toast-enter'} pointer-events-auto flex w-full max-w-sm cursor-pointer items-start gap-2.5 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 text-sm font-medium text-white shadow-xl shadow-slate-900/25 backdrop-blur`}
      >
        <AlertCircle className='toast-icon-pop mt-0.5 h-4 w-4 shrink-0 text-amber-400' />
        <span className='leading-snug'>{toast}</span>
      </div>
    </div>,
    document.body,
  )
}
