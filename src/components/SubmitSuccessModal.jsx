import { CheckCircle2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { Button } from './ui/button'

// Централен pop-up со заматена позадина по успешно поднесена пријава
// (за регистрирани и анонимни корисници). Затворање со копче или клик надвор.
// Портал во <body>: transform-анимациите на страниците го расипуваат fixed.
export function SubmitSuccessModal({ open, onClose }) {
  const { t } = useApp()
  if (!open) return null

  return createPortal(
    <div
      className='fixed inset-0 z-[120] flex items-center justify-center p-4'
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
      <div className='consent-in relative w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl'>
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
