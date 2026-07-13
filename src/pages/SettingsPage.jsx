import { Bell, ChevronRight, Database, FileText, LogOut, Languages, Scale, Shield, ShieldCheck, Trash2, User } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { useApp } from '../context/AppContext'
import { LANGUAGES } from '../i18n/translations'
import { deleteAccountApi } from '../lib/api'

const ROLE_COLORS = {
  user: 'bg-sky-50 text-sky-700 border-sky-200',
  organization: 'bg-violet-50 text-violet-700 border-violet-200',
  admin: 'bg-rose-50 text-rose-700 border-rose-200',
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { auth, setAuth, t, language, setLanguage } = useApp()
  const roleLabel = (r) => t(`role.${r === 'organization' ? 'organization' : r === 'admin' ? 'admin' : 'user'}`)

  const [displayName, setDisplayName] = useState(auth.displayName || auth.email?.split('@')[0] || '')
  const [notifAir, setNotifAir] = useState(true)
  const [notifWaste, setNotifWaste] = useState(true)
  const [notifEvents, setNotifEvents] = useState(false)
  const [toast, setToast] = useState('')
  // Бришење сметка: бара потврда со лозинка (Play/App Store барање).
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  function saveProfile(e) {
    e.preventDefault()
    setAuth((a) => ({ ...a, displayName: displayName.trim() }))
    setToast(t('settings.saved'))
  }

  function logout() {
    setAuth({ isAuthenticated: false, role: 'user', email: '', isAnonymous: true })
    navigate('/auth-loading', { replace: true })
  }

  async function deleteAccount(e) {
    e.preventDefault()
    if (!deletePassword) return setToast(t('settings.deletePasswordRequired'))
    setDeleting(true)
    try {
      await deleteAccountApi({ email: auth.email, password: deletePassword })
      setToast(t('settings.accountDeleted'))
      setTimeout(logout, 800)
    } catch (err) {
      setToast(err.message || t('settings.deleteFailed'))
      setDeleting(false)
    }
  }

  return (
    <div className='space-y-5 max-w-2xl'>
      <div>
        <h1 className='text-2xl font-bold text-slate-900'>{t('settings.title')}</h1>
        <p className='mt-0.5 text-sm text-slate-500'>{t('settings.subtitle')}</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <User className='h-4 w-4 text-emerald-600' />
            {t('settings.profile')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center gap-4'>
            <div className='flex aspect-square h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold leading-none text-emerald-700 shrink-0'>
              {(displayName?.[0] || auth.email?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <p className='font-semibold text-slate-900'>{auth.email || t('settings.anonymous')}</p>
              <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[auth.role] || ROLE_COLORS.user}`}>
                {roleLabel(auth.role)}
              </span>
            </div>
          </div>

          <form onSubmit={saveProfile} className='space-y-3'>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-slate-700'>{t('settings.displayName')}</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('settings.displayNamePh')} className='h-10' />
            </div>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-slate-700'>{t('settings.email')}</label>
              <Input value={auth.email || ''} disabled className='h-10 bg-slate-50 text-slate-400 cursor-not-allowed' />
            </div>
            <Button type='submit' size='sm'>{t('settings.save')}</Button>
          </form>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Bell className='h-4 w-4 text-emerald-600' />
            {t('settings.notifications')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {[
            { label: t('settings.notifAir'), sub: t('settings.notifAirSub'), value: notifAir, set: setNotifAir },
            { label: t('settings.notifWaste'), sub: t('settings.notifWasteSub'), value: notifWaste, set: setNotifWaste },
            { label: t('settings.notifEvents'), sub: t('settings.notifEventsSub'), value: notifEvents, set: setNotifEvents },
          ].map((item) => (
            <div key={item.label} className='flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3'>
              <div>
                <p className='text-sm font-medium text-slate-800'>{item.label}</p>
                <p className='text-xs text-slate-500'>{item.sub}</p>
              </div>
              <button
                type='button'
                onClick={() => item.set((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${item.value ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${item.value ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Languages className='h-4 w-4 text-emerald-600' />
            {t('settings.language')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <p className='mb-2 text-sm font-medium text-slate-700'>{t('settings.languageLabel')}</p>
            <select
              value={language}
              onChange={(e) => { setLanguage(e.target.value); setToast(t('settings.langSaved')) }}
              className='h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm'
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Legal / Privacy — линкови до правната страница (преведена на 3 јазици) */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Scale className='h-4 w-4 text-emerald-600' />
            {t('legal.sectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {[
            { tab: 'privacy', label: t('legal.privacyLink'), icon: ShieldCheck },
            { tab: 'terms', label: t('legal.termsLink'), icon: FileText },
            { tab: 'attribution', label: t('legal.attributionLink'), icon: Database },
          ].map(({ tab, label, icon: Icon }) => (
            <button
              key={tab}
              type='button'
              onClick={() => navigate(`/legal?tab=${tab}`)}
              className='flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100'
            >
              <Icon className='h-4 w-4 shrink-0 text-slate-500' />
              <span className='flex-1 text-sm font-medium text-slate-800'>{label}</span>
              <ChevronRight className='h-4 w-4 shrink-0 text-slate-400' />
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Shield className='h-4 w-4 text-emerald-600' />
            {t('settings.account')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='rounded-xl border border-slate-100 bg-slate-50 px-4 py-3'>
            <p className='text-sm font-medium text-slate-700'>{t('settings.appVersion')}</p>
            <p className='text-xs text-slate-500 mt-0.5'>EkoSkopje v1.0.0</p>
            <p className='text-xs text-slate-400 mt-1'>{t('common.credit')}</p>
          </div>
          <Button
            variant='outline'
            className='w-full justify-start gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300'
            onClick={logout}
          >
            <LogOut className='h-4 w-4' />
            {t('settings.logout')}
          </Button>

          {/* Бришење сметка — само за регистрирани корисници (Play/App Store барање) */}
          {!auth.isAnonymous && auth.email && auth.role !== 'admin' && (
            !deleteOpen ? (
              <button
                type='button'
                onClick={() => setDeleteOpen(true)}
                className='flex w-full items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-50'
              >
                <Trash2 className='h-4 w-4' />
                {t('settings.deleteAccount')}
              </button>
            ) : (
              <form onSubmit={deleteAccount} className='space-y-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3'>
                <p className='text-sm font-semibold text-rose-700'>{t('settings.deleteAccount')}</p>
                <p className='text-xs leading-relaxed text-rose-600'>{t('settings.deleteWarning')}</p>
                <Input
                  type='password'
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder={t('settings.deletePasswordPh')}
                  className='h-10 border-rose-200 bg-white'
                  autoComplete='current-password'
                />
                <div className='flex gap-2'>
                  <Button type='submit' size='sm' disabled={deleting} className='flex-1 bg-rose-600 hover:bg-rose-700'>
                    {deleting ? t('settings.deleting') : t('settings.deleteConfirm')}
                  </Button>
                  <Button type='button' size='sm' variant='outline' onClick={() => { setDeleteOpen(false); setDeletePassword('') }}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </form>
            )
          )}
        </CardContent>
      </Card>

      <Toast toast={toast} onClose={() => setToast('')} />
    </div>
  )
}
