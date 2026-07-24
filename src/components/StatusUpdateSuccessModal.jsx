import { CheckCircle2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { Button } from './ui/button'

// Централен pop-up по успешна промена на статус на пријава (админ).
export function StatusUpdateSuccessModal({ open, title, body, onClose }) {
  const { t } = useApp()
  if (!open) return null

  return createPortal(
    <div
      className='fixed inset-0 z-[1300] flex items-center justify-center p-4'
      role='dialog'
      aria-modal='true'
      aria-labelledby='status-success-title'
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
        <h2 id='status-success-title' className='mt-4 text-lg font-bold text-slate-900'>
          {title}
        </h2>
        {body && (
          <p className='mt-1.5 text-sm leading-relaxed text-slate-500'>{body}</p>
        )}
        <Button className='mt-5 w-full' onClick={onClose}>{t('common.ok')}</Button>
      </div>
    </div>,
    document.body,
  )
}
