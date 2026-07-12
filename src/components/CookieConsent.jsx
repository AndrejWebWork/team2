import { Cookie } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { useApp } from '../context/AppContext'

export const CONSENT_KEY = 'ekoskopje.cookieConsent'

// Читање на тековната одлука ('all' | 'necessary' | null).
export function getConsentChoice() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    return raw ? JSON.parse(raw).choice : null
  } catch { return null }
}

// Запишување/менување на одлуката од друго место (пр. Поставки).
export function setConsentChoice(choice) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, at: new Date().toISOString() }))
  } catch { /* localStorage недостапен */ }
}

// Бришење на одлуката (банерот повторно ќе се појави при следно вчитување).
export function clearConsentChoice() {
  try { localStorage.removeItem(CONSENT_KEY) } catch { /* тивко игнорирај */ }
}

// Банер за согласност за локално зачувување (кеш/колачиња) при прво отворање.
// Одлуката се памти локално; веднаш повторно не се прикажува.
export function CookieConsent() {
  const { t } = useApp()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let stored = null
    try { stored = localStorage.getItem(CONSENT_KEY) } catch { /* недостапен */ }
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [])

  function decide(choice) {
    setConsentChoice(choice)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className='consent-overlay fixed inset-0 z-[2500] flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm'>
      <div
        role='dialog'
        aria-modal='true'
        aria-label={t('cookie.title')}
        className='consent-in w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-2xl shadow-slate-900/20'
      >
        <span className='mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:h-10 sm:w-10'>
          <Cookie className='h-6 w-6 sm:h-5 sm:w-5' />
        </span>
        <p className='mt-2.5 text-base font-semibold text-slate-900 sm:text-sm'>{t('cookie.title')}</p>
        <p className='mt-1 text-sm leading-relaxed text-slate-600 sm:text-xs'>{t('cookie.body')}</p>
        <button
          type='button'
          onClick={() => navigate('/legal?tab=privacy')}
          className='mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline sm:text-xs'
        >
          {t('cookie.learn')}
        </button>
        <div className='mt-3.5 flex flex-col gap-2'>
          <Button size='sm' onClick={() => decide('all')} className='h-11 w-full text-sm sm:h-9'>{t('cookie.accept')}</Button>
          <Button size='sm' variant='outline' onClick={() => decide('necessary')} className='h-11 w-full text-sm sm:h-9'>{t('cookie.necessary')}</Button>
        </div>
      </div>
    </div>
  )
}
