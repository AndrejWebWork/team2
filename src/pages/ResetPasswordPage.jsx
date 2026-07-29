import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useApp } from '../context/AppContext'
import { resetPasswordApi } from '../lib/api'
import { loginNavState } from '../lib/authNav'
import { LOGO_SRC } from '../lib/brand'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { t } = useApp()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [toast, setToast] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    if (!token) return setToast(t('reset.invalidLink'))
    if (password.length < 6) return setToast(t('login.passwordMin'))
    if (password !== confirm) return setToast(t('login.passwordMismatch'))
    setBusy(true)
    try {
      await resetPasswordApi({ token, password })
      setDone(true)
    } catch (err) {
      setToast(err?.message || t('reset.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center p-4 app-safe-page'>
      <button
        type='button'
        onClick={() => navigate('/login', { state: loginNavState(location.state?.returnTo) })}
        aria-label={t('common.back')}
        className='app-safe-back flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 pl-3 pr-4 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-slate-900'
      >
        <ArrowLeft className='h-4 w-4' />
        {t('common.back')}
      </button>

      <div className='w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-2xl shadow-slate-200/80 sm:p-10'>
        <div className='mb-8 flex justify-center'>
          <span className='inline-flex items-center justify-center rounded-2xl bg-white p-2 shadow-md ring-1 ring-slate-100'>
            <img src={LOGO_SRC} alt='Еко Скопје' className='h-12 w-auto object-contain' />
          </span>
        </div>

        {done ? (
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-slate-900'>{t('reset.doneTitle')}</h1>
            <p className='mt-3 text-sm leading-relaxed text-slate-600'>{t('reset.doneBody')}</p>
            <Button
              className='mt-8 h-11 w-full'
              onClick={() => navigate('/login', { state: loginNavState(location.state?.returnTo) })}
            >
              {t('forgot.backToLogin')}
            </Button>
          </div>
        ) : !token ? (
          <div className='text-center'>
            <h1 className='text-2xl font-bold text-slate-900'>{t('reset.invalidTitle')}</h1>
            <p className='mt-3 text-sm leading-relaxed text-slate-600'>{t('reset.invalidBody')}</p>
            <Link
              to='/forgot-password'
              state={{ returnTo: location.state?.returnTo }}
              className='mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-base font-semibold text-slate-700 hover:bg-slate-50'
            >
              {t('login.forgotPassword')}
            </Link>
          </div>
        ) : (
          <>
            <h1 className='text-2xl font-bold text-slate-900'>{t('reset.title')}</h1>
            <p className='mt-2 text-sm text-slate-500'>{t('reset.subtitle')}</p>

            <form onSubmit={onSubmit} className='mt-8 space-y-4'>
              <div className='space-y-1.5'>
                <label className='text-sm font-medium text-slate-700'>{t('reset.newPassword')}</label>
                <div className='relative'>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder='••••••••'
                    type={showPass ? 'text' : 'password'}
                    autoComplete='new-password'
                    className='h-11 pr-10'
                  />
                  <button
                    type='button'
                    onClick={() => setShowPass((v) => !v)}
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600'
                  >
                    {showPass ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                  </button>
                </div>
              </div>
              <div className='space-y-1.5'>
                <label className='text-sm font-medium text-slate-700'>{t('login.confirmPassword')}</label>
                <Input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder='••••••••'
                  type={showPass ? 'text' : 'password'}
                  autoComplete='new-password'
                  className='h-11'
                />
              </div>
              <Button type='submit' disabled={busy} className='h-11 w-full text-base font-semibold'>
                {busy && <Loader2 className='h-4 w-4 animate-spin' />}
                {t('reset.submit')}
              </Button>
            </form>
          </>
        )}
      </div>
      <Toast toast={toast} onClose={() => setToast('')} />
    </div>
  )
}
