import { Shield, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Toast } from './Toast'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { useApp } from '../context/AppContext'
import { addSubAdminApi, fetchSubAdminsApi, removeSubAdminApi } from '../lib/api'

const ROLE_OPTIONS = [
  { value: 'admin_inspection', labelKey: 'role.adminInspection' },
  { value: 'admin_environment', labelKey: 'role.adminEnvironment' },
  { value: 'admin_hygiene', labelKey: 'role.adminHygiene' },
]

const emptyForm = { email: '', displayName: '', role: 'admin_inspection', password: '' }

export function SubAdminsManager() {
  const { t, language } = useApp()
  const [users, setUsers] = useState([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    const controller = new AbortController()
    fetchSubAdminsApi(controller.signal)
      .then((list) => { if (!controller.signal.aborted) setUsers(Array.isArray(list) ? list : []) })
      .catch(() => { /* backend офлајн */ })
    return () => controller.abort()
  }, [])

  function roleLabel(role) {
    const opt = ROLE_OPTIONS.find((o) => o.value === role)
    return opt ? t(opt.labelKey) : role
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (busy) return
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setToast(t('login.invalidEmail'))
    if (!form.password || form.password.length < 6) {
      const exists = users.some((u) => u.email === form.email.trim().toLowerCase())
      if (!exists) return setToast(t('admin.subPasswordRequired'))
    }
    setBusy(true)
    try {
      const created = await addSubAdminApi({
        email: form.email.trim().toLowerCase(),
        displayName: form.displayName.trim() || null,
        role: form.role,
        password: form.password || null,
        language,
      })
      setUsers((prev) => {
        const email = created.email
        const exists = prev.some((u) => u.email === email)
        if (exists) return prev.map((u) => (u.email === email ? created : u))
        return [created, ...prev]
      })
      setToast(t('admin.subAdded'))
      setForm(emptyForm)
      setOpen(false)
    } catch (err) {
      setToast(err.message || t('admin.subAdd'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(email) {
    if (!window.confirm(t('admin.subConfirmRemove'))) return
    try {
      await removeSubAdminApi(email)
      setToast(t('admin.subRemoved'))
      setUsers((prev) => prev.filter((u) => u.email !== email))
    } catch (err) {
      setToast(err.message || t('admin.subRemove'))
    }
  }

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Shield className='h-4 w-4 text-rose-600' />{t('admin.subTitle')}
            </CardTitle>
            <p className='mt-0.5 text-sm text-slate-500'>{t('admin.subDesc')}</p>
          </div>
          <Button size='sm' onClick={() => setOpen((v) => !v)} className='w-full sm:w-auto'>
            <UserPlus className='h-4 w-4' />{t('admin.subAdd')}
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
                <label className='text-xs font-semibold text-slate-600'>{t('admin.subRole')}</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className='h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm'
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div className='space-y-1'>
                <label className='text-xs font-semibold text-slate-600'>{t('admin.communityPassword')}</label>
                <Input type='password' value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder='••••••••' className='h-10' />
              </div>
            </div>
            <p className='text-xs text-slate-400'>{t('admin.communityPasswordHint')}</p>
            <Button type='submit' size='sm' disabled={busy}>{t('admin.subSubmit')}</Button>
          </form>
        )}

        {users.length === 0 ? (
          <p className='rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400'>{t('admin.subEmpty')}</p>
        ) : (
          <ul className='divide-y divide-slate-100'>
            {users.map((u, i) => (
              <li key={u.id} className='stagger-item flex items-center justify-between gap-3 py-3' style={{ '--i': i }}>
                <div className='min-w-0'>
                  <p className='flex flex-wrap items-center gap-2 truncate font-semibold text-slate-800'>
                    {u.displayName || u.email}
                    <span className='inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700'>
                      <Shield className='h-2.5 w-2.5' />{roleLabel(u.role)}
                    </span>
                  </p>
                  <p className='truncate text-xs text-slate-500'>{u.email}</p>
                </div>
                <button
                  type='button'
                  onClick={() => remove(u.email)}
                  aria-label={t('admin.subRemove')}
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
