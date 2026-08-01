import { ArrowLeft, Eye, EyeOff, Leaf, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { BRAND_SRC, GRB_SRC, LOGO_SRC } from '../lib/brand'
import { loginNavState, resolveAuthReturnTo } from '../lib/authNav'
import { useApp } from '../context/AppContext'
import { isAdminRole, postLoginPath } from '../lib/roles'

function destForRole(role) {
  if (isAdminRole(role)) return postLoginPath(role)
  if (role === 'organization') return '/community'
  return '/home'
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, register, t } = useApp()
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!location.state?.allowLogin) navigate('/air', { replace: true })
  }, [location.state, navigate])

  function goBack() {
    navigate(resolveAuthReturnTo(location.state?.returnTo), { replace: true })
  }

  async function onSubmit(e) {
    e.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return setToast(t('login.invalidEmail'))
    if (password.length < 6) return setToast(t('login.passwordMin'))
    if (mode === 'register' && fullName.trim().length < 2) return setToast(t('login.enterName'))
    setBusy(true)
    try {
      const user = mode === 'login'
        ? await login({ email: normalized, password })
        : await register({ email: normalized, password, displayName: fullName.trim() })
      navigate(destForRole(user?.role))
    } catch (err) {
      setToast(err?.message || (mode === 'login' ? t('login.loginFailed') : t('login.registerFailed')))
    } finally {
      setBusy(false)
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
    setToast('')
  }

  return (
    <div className='relative min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center p-4 app-safe-page'>
      {/* Копче назад — горе ЛЕВО, стрелка + збор „Назад" во балонче (сите уреди). */}
      <button
        type='button'
        onClick={goBack}
        aria-label={t('common.back')}
        className='app-safe-back flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 pl-3 pr-4 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-slate-900'
      >
        <ArrowLeft className='h-4 w-4' />
        {t('common.back')}
      </button>

      <div className='w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl shadow-slate-200/80 border border-slate-100 bg-white flex min-h-[600px]'>

        {/* Left panel — илустрација на Скопје со емералд превез */}
        <div className='hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white relative overflow-hidden'>
          <img src={BRAND_SRC} alt={t('comm.skopje')} className='absolute inset-0 h-full w-full object-cover' />
          <div className='absolute inset-0 bg-gradient-to-br from-emerald-900/90 via-emerald-800/70 to-emerald-950/90' />

          <div className='relative'>
            <span className='inline-flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-lg'>
              <img src={GRB_SRC} alt={t('brand.coatAlt')} className='h-12 w-auto object-contain' draggable={false} />
              <span className='h-10 w-px bg-slate-200' aria-hidden />
              <img src={LOGO_SRC} alt='Еко Скопје' className='h-11 w-auto object-contain' draggable={false} />
            </span>
            <h1 className='mt-8 text-4xl font-extrabold tracking-tight leading-tight drop-shadow-sm'>
              {t('login.heroTitle')}
            </h1>
            <p className='mt-4 text-emerald-50/90 text-base leading-relaxed max-w-xs'>
              {t('login.heroSubtitle')}
            </p>
          </div>

          <div className='relative space-y-3 text-sm text-white/90'>
            <div className='flex items-center gap-3'>
              <Leaf className='h-4 w-4 shrink-0' />
              <span>{t('login.feature1')}</span>
            </div>
            <div className='flex items-center gap-3'>
              <Leaf className='h-4 w-4 shrink-0' />
              <span>{t('login.feature2')}</span>
            </div>
            <div className='flex items-center gap-3'>
              <Leaf className='h-4 w-4 shrink-0' />
              <span>{t('login.feature3')}</span>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className='flex-1 flex flex-col justify-center px-8 py-12 sm:px-12'>
          <div className='lg:hidden mb-8 flex justify-center'>
            <span className='inline-flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-md ring-1 ring-slate-100'>
              <img src={GRB_SRC} alt={t('brand.coatAlt')} className='h-12 w-auto object-contain' draggable={false} />
              <span className='h-10 w-px bg-slate-200' aria-hidden />
              <img src={LOGO_SRC} alt='Еко Скопје' className='h-12 w-auto object-contain' draggable={false} />
            </span>
          </div>

          <h2 className='text-3xl font-bold text-slate-900 tracking-tight'>
            {mode === 'login' ? t('login.welcomeBack') : t('login.createAccount')}
          </h2>
          <p className='mt-1.5 text-sm text-slate-500'>
            {mode === 'login' ? t('login.loginSubtitle') : t('login.registerSubtitle')}
          </p>

          <form onSubmit={onSubmit} className='mt-8 space-y-4'>
            {mode === 'register' && (
              <div className='space-y-1.5'>
                <label className='text-sm font-medium text-slate-700'>{t('login.fullName')}</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('login.fullNamePh')}
                  type='text'
                  className='h-11'
                />
              </div>
            )}
            <div className='space-y-1.5'>
              <label className='text-sm font-medium text-slate-700'>{t('login.email')}</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='your@email.com'
                type='email'
                className='h-11'
              />
            </div>
            <div className='space-y-1.5'>
              <label className='text-sm font-medium text-slate-700'>{t('login.password')}</label>
              <div className='relative'>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder='••••••••'
                  type={showPass ? 'text' : 'password'}
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
              {mode === 'login' && (
                <div className='flex justify-end'>
                  <Link
                    to='/forgot-password'
                    state={{ returnTo: location.state?.returnTo }}
                    className='text-sm font-medium text-emerald-600 hover:text-emerald-700'
                  >
                    {t('login.forgotPassword')}
                  </Link>
                </div>
              )}
            </div>
            <Button type='submit' disabled={busy} className='h-11 w-full text-base font-semibold mt-2'>
              {busy && <Loader2 className='h-4 w-4 animate-spin' />}
              {mode === 'login' ? t('login.signIn') : t('login.signUp')}
            </Button>
          </form>

          {/* Мобилен: посебно копче (поголемо, појасно од link). */}
          <div className='mt-6 space-y-3 lg:hidden'>
            <p className='text-center text-sm text-slate-500'>
              {mode === 'login' ? t('login.noAccountQ') : t('login.haveAccountQ')}
            </p>
            <Button
              type='button'
              variant='outline'
              className='h-11 w-full border-emerald-200 text-base font-semibold text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50'
              onClick={toggleMode}
            >
              {mode === 'login' ? t('login.signUp') : t('login.signIn')}
            </Button>
          </div>

          {/* Desktop: inline link како досега. */}
          <p className='mt-6 hidden text-center text-sm text-slate-500 lg:block'>
            {mode === 'login' ? t('login.noAccountQ') : t('login.haveAccountQ')}{' '}
            <button
              type='button'
              onClick={toggleMode}
              className='font-semibold text-emerald-600 hover:text-emerald-700'
            >
              {mode === 'login' ? t('login.signUp') : t('login.signIn')}
            </button>
          </p>
        </div>
      </div>
      <Toast toast={toast} onClose={() => setToast('')} />
    </div>
  )
}
