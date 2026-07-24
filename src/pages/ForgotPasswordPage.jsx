import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useApp } from '../context/AppContext'
import { forgotPasswordApi } from '../lib/api'
import { LOGO_SRC } from '../lib/brand'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { t } = useApp()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [toast, setToast] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return setToast(t('login.invalidEmail'))
    setBusy(true)
    try {
      await forgotPasswordApi({ email: normalized })
      setSent(true)
    } catch (err) {
      if (err?.status === 404) setToast(t('forgot.notFound'))
      else if (err?.status === 400) setToast(t('forgot.noPassword'))
      else setToast(err?.message || t('forgot.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center p-4'>
      <button
        type='button'
        onClick={() => navigate('/login', { state: { allowLogin: true } })}
        aria-label={t('common.back')}
        className='absolute left-4 z-20 flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 pl-3 pr-4 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-slate-900'
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <ArrowLeft className='h-4 w-4' />
        {t('common.back')}
      </button>

      <div className='w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-2xl shadow-slate-200/80 sm:p-10'>
        <div className='mb-8 flex justify-center'>
          <span className='inline-flex items-center justify-center rounded-2xl bg-white p-2 shadow-md ring-1 ring-slate-100'>
            <img src={LOGO_SRC} alt='EkoSkopje' className='h-12 w-auto object-contain' />
          </span>
        </div>

        {sent ? (
          <div className='text-center'>
            <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700'>
              <Mail className='h-7 w-7' />
            </div>
            <h1 className='text-2xl font-bold text-slate-900'>{t('forgot.sentTitle')}</h1>
            <p className='mt-3 text-sm leading-relaxed text-slate-600'>{t('forgot.sentBody')}</p>
            <Button
              className='mt-8 h-11 w-full'
              onClick={() => navigate('/login', { state: { allowLogin: true } })}
            >
              {t('forgot.backToLogin')}
            </Button>
          </div>
        ) : (
          <>
            <h1 className='text-2xl font-bold text-slate-900'>{t('forgot.title')}</h1>
            <p className='mt-2 text-sm text-slate-500'>{t('forgot.subtitle')}</p>

            <form onSubmit={onSubmit} className='mt-8 space-y-4'>
              <div className='space-y-1.5'>
                <label className='text-sm font-medium text-slate-700'>{t('login.email')}</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='your@email.com'
                  type='email'
                  autoComplete='email'
                  className='h-11'
                />
              </div>
              <Button type='submit' disabled={busy} className='h-11 w-full text-base font-semibold'>
                {busy && <Loader2 className='h-4 w-4 animate-spin' />}
                {t('forgot.submit')}
              </Button>
            </form>
          </>
        )}
      </div>
      <Toast toast={toast} onClose={() => setToast('')} />
    </div>
  )
}
