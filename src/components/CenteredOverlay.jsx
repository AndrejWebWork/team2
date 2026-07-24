import { useEffect } from 'react'
import { createPortal } from 'react-dom'

// Центриран full-screen overlay — портал во <body>, над mobile nav и page animations.
export function CenteredOverlay({
  open,
  onClose,
  labelledBy,
  describedBy,
  ariaLabel,
  panelClassName = '',
  children,
}) {
  useEffect(() => {
    if (!open) return undefined

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    window.scrollTo(0, 0)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className='app-modal-overlay'
      role='dialog'
      aria-modal='true'
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <div
        className={`app-modal-panel ${panelClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
