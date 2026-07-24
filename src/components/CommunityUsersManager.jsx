import { Megaphone, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { InstagramIcon } from './InstagramIcon'
import { Toast } from './Toast'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { useApp } from '../context/AppContext'
import { addCommunityUserApi, fetchCommunityUsersApi, removeCommunityUserApi } from '../lib/api'
import { instagramProfileUrl, normalizeInstagramHandle } from '../lib/instagram'

// Админ секција: додавање/отстранување на influencer/community корисници
// (улога 'organization' во базата) кои можат да објавуваат акции.
export function CommunityUsersManager() {
  const { t, language } = useApp()
  const [users, setUsers] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({ email: '', displayName: '', organizationName: '', instagramHandle: '', password: '' })

  useEffect(() => {
    const controller = new AbortController()
    fetchCommunityUsersApi(controller.signal)
      .then((list) => { if (!controller.signal.aborted) setUsers(Array.isArray(list) ? list : []) })
      .catch(() => { /* backend офлајн — прикажи празна листа */ })
    return () => controller.abort()
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    if (busy) return
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setToast(t('login.invalidEmail'))
    setBusy(true)
    try {
      const created = await addCommunityUserApi({
        email: form.email.trim().toLowerCase(),
        displayName: form.displayName.trim() || null,
        organizationName: form.organizationName.trim() || null,
        instagramHandle: normalizeInstagramHandle(form.instagramHandle) || null,
        password: form.password || null,
        language,
      })
      setUsers((prev) => {
        const email = created.email
        const exists = prev.some((u) => u.email === email)
        if (exists) return prev.map((u) => (u.email === email ? created : u))
        return [created, ...prev]
      })
      setToast(t('admin.communityAdded'))
      setForm({ email: '', displayName: '', organizationName: '', instagramHandle: '', password: '' })
      setOpen(false)
    } catch (err) {
      setToast(err.message || t('admin.communityAdd'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(email) {
    if (!window.confirm(t('admin.communityConfirmRemove'))) return
    try {
      await removeCommunityUserApi(email)
      setToast(t('admin.communityRemoved'))
      setUsers((prev) => prev.filter((u) => u.email !== email))
    } catch (err) {
      setToast(err.message || t('admin.communityRemove'))
    }
  }

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Megaphone className='h-4 w-4 text-emerald-600' />{t('admin.communityTitle')}
            </CardTitle>
            <p className='mt-0.5 text-sm text-slate-500'>{t('admin.communityDesc')}</p>
          </div>
          <Button size='sm' onClick={() => setOpen((v) => !v)} className='w-full sm:w-auto'>
            <UserPlus className='h-4 w-4' />{t('admin.communityAdd')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {open && (
          <form onSubmit={onSubmit} className='stagger-item space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4' style={{ '--i': 0 }}>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='space-y-1'>
                <label className='text-xs font-semibold text-slate-600'>{t('admin.communityEmail')}</label>
                <Input type='email' value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder='ime@primer.mk' className='h-10' />
              </div>
              <div className='space-y-1'>
                <label className='text-xs font-semibold text-slate-600'>{t('admin.communityName')}</label>
                <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} className='h-10' />
              </div>
              <div className='space-y-1'>
                <label className='text-xs font-semibold text-slate-600'>{t('admin.communityOrg')}</label>
                <Input value={form.organizationName} onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))} className='h-10' />
              </div>
              <div className='space-y-1 sm:col-span-2'>
                <label className='text-xs font-semibold text-slate-600'>{t('admin.communityInstagram')}</label>
                <div className='relative'>
                  <InstagramIcon className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pink-500' />
                  <Input
                    value={form.instagramHandle}
                    onChange={(e) => setForm((f) => ({ ...f, instagramHandle: e.target.value }))}
                    placeholder={t('admin.communityInstagramPlaceholder')}
                    className='h-10 pl-10'
                  />
                </div>
              </div>
              <div className='space-y-1'>
                <label className='text-xs font-semibold text-slate-600'>{t('admin.communityPassword')}</label>
                <Input type='password' value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder='••••••••' className='h-10' />
              </div>
            </div>
            <p className='text-xs text-slate-400'>{t('admin.communityPasswordHint')}</p>
            <Button type='submit' size='sm' disabled={busy}>{t('admin.communitySubmit')}</Button>
          </form>
        )}

        {users.length === 0 ? (
          <p className='rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400'>{t('admin.communityEmpty')}</p>
        ) : (
          <ul className='divide-y divide-slate-100'>
            {users.map((u, i) => (
              <li key={u.id} className='stagger-item flex items-center justify-between gap-3 py-3' style={{ '--i': i }}>
                <div className='min-w-0'>
                  <p className='flex items-center gap-2 truncate font-semibold text-slate-800'>
                    {u.displayName || u.email}
                    <span className='inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700'>
                      <Megaphone className='h-2.5 w-2.5' />{t('admin.communityRole')}
                    </span>
                  </p>
                  <p className='truncate text-xs text-slate-500'>
                    {u.email}{u.organizationName ? ` · ${u.organizationName}` : ''}
                  </p>
                  {u.instagramHandle && (
                    <a
                      href={instagramProfileUrl(u.instagramHandle)}
                      target='_blank'
                      rel='noreferrer'
                      className='mt-1 inline-flex items-center gap-1 text-xs font-semibold text-pink-600 hover:text-pink-700'
                    >
                      <InstagramIcon className='h-3.5 w-3.5' />@{normalizeInstagramHandle(u.instagramHandle)}
                    </a>
                  )}
                </div>
                <button
                  type='button'
                  onClick={() => remove(u.email)}
                  aria-label={t('admin.communityRemove')}
                  className='shrink-0 rounded-lg border border-rose-200 bg-white p-2 text-rose-500 transition-colors hover:bg-rose-50'
                >
                  <Trash2 className='h-4 w-4' />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Toast toast={toast} onClose={() => setToast('')} />
    </Card>
  )
}
