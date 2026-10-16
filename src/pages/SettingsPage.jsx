import { Bell, Check, ChevronDown, ChevronRight, Database, FileText, LogIn, LogOut, Languages, Mail, Scale, ScrollText, Shield, ShieldCheck, Trash2, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { useApp } from '../context/AppContext'
import { IMPRESSUM_TECH_CREDIT } from '../i18n/impressum'
import { LEGAL_CONTACT } from '../i18n/legal'
import { LANGUAGES, translate } from '../i18n/translations'
import { deleteAccountApi, fetchUser, updateUserSettingsApi } from '../lib/api'
import { loginNavState } from '../lib/authNav'
import { isAdminRole } from '../lib/roles'

const LANG_CODE = { mk: 'МК', en: 'EN', sq: 'SQ' }

function LanguagePicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const current = LANGUAGES.find((l) => l.id === value) || LANGUAGES[0]

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className={`lang-picker ${open ? 'is-open' : ''}`} ref={wrapRef}>
      <button
        type='button'
        className='lang-picker-trigger'
        aria-expanded={open}
        aria-haspopup='listbox'
        onClick={() => setOpen((v) => !v)}
      >
        <span className='lang-picker-code'>{LANG_CODE[current.id] || current.id.toUpperCase()}</span>
        <span className='lang-picker-copy'>
          <span className='lang-picker-name'>{current.label}</span>
        </span>
        <ChevronDown className='lang-picker-chevron' aria-hidden />
      </button>
      <div className='lang-picker-menu' role='listbox' aria-label={current.label}>
        {LANGUAGES.map((l) => {
          const active = l.id === value
          return (
            <button
              key={l.id}
              type='button'
              role='option'
              aria-selected={active}
              className={`lang-picker-option${active ? ' is-active' : ''}`}
              onClick={() => {
                onChange(l.id)
                setOpen(false)
              }}
            >
              <span className='lang-picker-code'>{LANG_CODE[l.id] || l.id.toUpperCase()}</span>
              <span className='lang-picker-name'>{l.label}</span>
              <Check className='lang-picker-check' aria-hidden />
            </button>
          )
        })}
      </div>
    </div>
  )
}

const ROLE_COLORS = {
  user: 'bg-sky-50 text-sky-700 border-sky-200',
  organization: 'bg-violet-50 text-violet-700 border-violet-200',
  admin: 'bg-rose-50 text-rose-700 border-rose-200',
  admin_inspection: 'bg-amber-50 text-amber-700 border-amber-200',
  admin_environment: 'bg-sky-50 text-sky-700 border-sky-200',
  admin_hygiene: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { auth, setAuth, logout, t, language, setLanguage, notifAir, setNotifAir } = useApp()
  const roleLabel = (r) => {
    if (r === 'organization') return t('role.organization')
    if (r === 'admin') return t('role.admin')
    if (r === 'admin_inspection') return t('role.adminInspection')
    if (r === 'admin_environment') return t('role.adminEnvironment')
    if (r === 'admin_hygiene') return t('role.adminHygiene')
    return t('role.user')
  }
  const isAnonymous = auth.isAnonymous || !auth.email
  const anonymousLabel = t('settings.anonymous')

  const [displayName, setDisplayName] = useState(
    isAnonymous ? anonymousLabel : (auth.displayName || auth.email?.split('@')[0] || ''),
  )
  const [notifWaste, setNotifWaste] = useState(true)
  const [notifEvents, setNotifEvents] = useState(false)
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)
  // Бришење сметка: бара потврда со лозинка (Play/App Store барање).
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Вчитај поставки од базата при отворање (име, нотификации).
  useEffect(() => {
    if (isAnonymous) {
      setDisplayName(anonymousLabel)
      return undefined
    }
    if (!auth.email) return undefined
    let cancelled = false
    fetchUser(auth.email)
      .then((user) => {
        if (cancelled || !user) return
        if (user.display_name) setDisplayName(user.display_name)
        if (user.notif_waste != null) setNotifWaste(user.notif_waste)
        if (user.notif_events != null) setNotifEvents(user.notif_events)
      })
      .catch(() => { /* офлајн — остануваат локалните вредности */ })
    return () => { cancelled = true }
  }, [auth.email, isAnonymous, anonymousLabel])

  async function saveProfile(e) {
    e.preventDefault()
    if (isAnonymous) return

    const name = displayName.trim()
    if (!name) return setToast(t('settings.displayNamePh'))

    setSaving(true)
    try {
      await updateUserSettingsApi({ email: auth.email, displayName: name })
      setAuth((a) => ({ ...a, displayName: name }))
      setToast(t('settings.saved'))
    } catch (err) {
      setToast(err.message || t('settings.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function saveNotif(key, value, setter) {
    setter(value)
    if (auth.isAnonymous || !auth.email) return
    try {
      await updateUserSettingsApi({ email: auth.email, [key]: value })
    } catch {
      setter(!value)
      setToast(t('settings.saveFailed'))
    }
  }

  function handleLogout() {
    logout()
    navigate('/home', { replace: true })
  }

  async function deleteAccount(e) {
    e.preventDefault()
    if (!deletePassword) return setToast(t('settings.deletePasswordRequired'))
    setDeleting(true)
    try {
      await deleteAccountApi({ email: auth.email, password: deletePassword })
      setToast(t('settings.accountDeleted'))
      setTimeout(handleLogout, 800)
    } catch (err) {
      setToast(err.message || t('settings.deleteFailed'))
      setDeleting(false)
    }
  }

  return (
    <div className='settings-page space-y-5 max-w-2xl'>
      <div className='settings-hero'>
        <h1 className='text-2xl font-bold text-slate-900'>{t('settings.title')}</h1>
        <p className='mt-0.5 text-sm text-slate-500'>{t('settings.subtitle')}</p>
      </div>

      {/* Profile */}
      <Card className='settings-card'>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <User className='h-4 w-4 text-emerald-600' />
            {t('settings.profile')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center gap-4'>
            <div className='settings-avatar flex aspect-square h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold leading-none text-emerald-700 shrink-0'>
              {(isAnonymous ? anonymousLabel[0] : (displayName?.[0] || auth.email?.[0] || '?')).toUpperCase()}
            </div>
            <div>
              <p className='font-semibold text-slate-900'>{isAnonymous ? anonymousLabel : (displayName || auth.email)}</p>
              <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[auth.role] || ROLE_COLORS.user}`}>
                {roleLabel(auth.role)}
              </span>
            </div>
          </div>

          <form onSubmit={saveProfile} className='space-y-3'>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-slate-700'>{t('settings.displayName')}</label>
              <Input
                value={isAnonymous ? anonymousLabel : displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('settings.displayNamePh')}
                disabled={isAnonymous}
                className={`h-10 ${isAnonymous ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
              />
              {isAnonymous && (
                <div className='pt-1'>
                  <p className='text-xs leading-relaxed text-slate-500'>{t('settings.anonymousNameHint')}</p>
                  <Button
                    type='button'
                    size='sm'
                    className='mt-2'
                    onClick={() => navigate('/login', { state: loginNavState('/settings') })}
                  >
                    <LogIn className='h-3.5 w-3.5' />
                    {t('login.signIn')}
                  </Button>
                </div>
              )}
            </div>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-slate-700'>{t('settings.email')}</label>
              <Input
                value={isAnonymous ? t('settings.anonymousEmailPlaceholder') : (auth.email || '')}
                disabled
                className='h-10 bg-slate-50 text-slate-400 cursor-not-allowed'
              />
            </div>
            {!isAnonymous && (
              <Button type='submit' size='sm' disabled={saving}>{saving ? t('settings.saving') : t('settings.save')}</Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className='settings-card'>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Bell className='h-4 w-4 text-emerald-600' />
            {t('settings.notifications')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {[
            { label: t('settings.notifAir'), sub: t('settings.notifAirSub'), value: notifAir, key: 'notifAir', set: setNotifAir },
            { label: t('settings.notifWaste'), sub: t('settings.notifWasteSub'), value: notifWaste, key: 'notifWaste', set: setNotifWaste },
            { label: t('settings.notifEvents'), sub: t('settings.notifEventsSub'), value: notifEvents, key: 'notifEvents', set: setNotifEvents },
          ].map((item) => (
            <div key={item.label} className='settings-row flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3'>
              <div>
                <p className='text-sm font-medium text-slate-800'>{item.label}</p>
                <p className='text-xs text-slate-500'>{item.sub}</p>
              </div>
              <button
                type='button'
                onClick={() => saveNotif(item.key, !item.value, item.set)}
                className={`settings-toggle relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent focus:outline-none ${item.value ? 'is-on bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`settings-toggle-knob inline-block h-5 w-5 transform rounded-full bg-white ${item.value ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Language */}
      <Card className='settings-card'>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Languages className='h-4 w-4 text-emerald-600' />
            {t('settings.language')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <p className='mb-2 text-sm font-medium text-slate-700'>{t('settings.languageLabel')}</p>
            <LanguagePicker
              value={language}
              onChange={(next) => {
                setLanguage(next)
                setToast(translate(next, 'settings.langSaved'))
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Legal / Privacy — линкови до правната страница (преведена на 3 јазици) */}
      <Card className='settings-card'>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Scale className='h-4 w-4 text-emerald-600' />
            {t('legal.sectionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {[
            { tab: 'privacy', label: t('legal.privacyLink'), icon: ShieldCheck, path: '/legal?tab=privacy' },
            { tab: 'terms', label: t('legal.termsLink'), icon: FileText, path: '/legal?tab=terms' },
            { tab: 'attribution', label: t('legal.attributionLink'), icon: Database, path: '/legal?tab=attribution' },
            { tab: 'impressum', label: t('impressum.link'), icon: ScrollText, path: '/impressum' },
          ].map(({ tab, label, icon: Icon, path }) => (
            <button
              key={tab}
              type='button'
              onClick={() => navigate(path)}
              className='settings-link flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left'
            >
              <Icon className='h-4 w-4 shrink-0 text-slate-500' />
              <span className='flex-1 text-sm font-medium text-slate-800'>{label}</span>
              <ChevronRight className='h-4 w-4 shrink-0 text-slate-400' />
            </button>
          ))}
          <a
            href={`mailto:${LEGAL_CONTACT}`}
            className='settings-link flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left'
          >
            <Mail className='h-4 w-4 shrink-0 text-slate-500' />
            <span className='min-w-0 flex-1'>
              <span className='block text-sm font-medium text-slate-800'>{t('legal.contactEmail')}</span>
              <span className='block truncate text-xs text-slate-500'>{LEGAL_CONTACT}</span>
            </span>
          </a>
        </CardContent>
      </Card>

      {/* Account */}
      <Card className='settings-card'>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Shield className='h-4 w-4 text-emerald-600' />
            {t('settings.account')}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='rounded-xl border border-slate-100 bg-slate-50 px-4 py-3'>
            <p className='text-sm font-medium text-slate-700'>{t('settings.appVersion')}</p>
            <p className='text-xs text-slate-500 mt-0.5'>Еко Скопје v1.0.2</p>
            <p className='text-xs text-slate-400 mt-1'>{t('common.credit')}</p>
            <p className='mt-2 text-[11px] leading-relaxed text-slate-400'>{IMPRESSUM_TECH_CREDIT[language] || IMPRESSUM_TECH_CREDIT.mk}</p>
          </div>
          {/* Одјава — само за најавени (анонимен нема сметка за одјава) */}
          {!isAnonymous && (
            <Button
              variant='outline'
              className='w-full justify-start gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300'
              onClick={handleLogout}
            >
              <LogOut className='h-4 w-4' />
              {t('settings.logout')}
            </Button>
          )}

          {/* Бришење сметка — само за регистрирани корисници (Play/App Store барање) */}
          {!isAnonymous && auth.email && !isAdminRole(auth.role) && (
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
