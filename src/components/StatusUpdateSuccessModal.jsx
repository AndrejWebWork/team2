import { CheckCircle2 } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { Button } from './ui/button'

// Централен pop-up по успешна промена на статус на пријава (админ).
export function StatusUpdateSuccessModal({ open, title, body, onClose }) {
  const { t } = useApp()

  useEffect(() => {
    if (!open) return undefined
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
      className='fixed inset-0 z-[2000] grid place-items-center overflow-y-auto overscroll-contain p-4 sm:p-6'
      style={{
        minHeight: '100dvh',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
      role='dialog'
      aria-modal='true'
      aria-labelledby='status-success-title'
    >
      <button
        type='button'
        aria-label={t('common.close')}
        onClick={onClose}
        className='absolute inset-0 cursor-default bg-slate-900/45 backdrop-blur-sm'
      />
      <div className='modal-in relative z-10 mx-auto w-full max-w-sm shrink-0 rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-2xl shadow-slate-900/20'>
        <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100'>
          <CheckCircle2 className='success-pop h-8 w-8 text-emerald-600' />
        </div>
        <h2 id='status-success-title' className='mt-4 text-lg font-bold leading-snug text-slate-900'>
          {title}
        </h2>
        {body && (
          <p className='mt-2 text-sm leading-relaxed text-slate-500'>{body}</p>
        )}
        <Button type='button' className='mt-6 h-11 w-full text-base' onClick={onClose}>
          {t('common.ok')}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
