import { CheckCircle2 } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { Button } from './ui/button'

// Централен pop-up со заматена позадина по успешно поднесена пријава
// (за регистрирани и анонимни корисници). Затvорање со копче или клик надвор.
// Портал во <body> + висок z-index: mobile nav (1200) не го покрива modal-ot.
export function SubmitSuccessModal({ open, onClose }) {
  const { t } = useApp()

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className='fixed inset-0 z-[1300] flex items-center justify-center p-4 sm:p-6'
      role='dialog'
      aria-modal='true'
      aria-labelledby='submit-modal-title'
    >
      <button
        type='button'
        aria-label={t('common.close')}
        onClick={onClose}
        className='consent-overlay absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-sm'
      />
      <div className='modal-in relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl'>
        <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100'>
          <CheckCircle2 className='success-pop h-8 w-8 text-emerald-600' />
        </div>
        <h2 id='submit-modal-title' className='mt-4 text-lg font-bold text-slate-900'>
          {t('submit.thankYouTitle')}
        </h2>
        <p className='mt-1.5 text-sm leading-relaxed text-slate-500'>
          {t('submit.thankYouBody')}
        </p>
        <Button className='mt-5 w-full' onClick={onClose}>{t('common.ok')}</Button>
      </div>
    </div>,
    document.body,
  )
}
