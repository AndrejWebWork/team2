import { Gift, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { fetchMyLeaderboardAward, submitLeaderboardAwardContactApi } from '../lib/api'
import { useApp } from '../context/AppContext'

/** Пловечко балонче + форма — само за наградени корисници што треба да дадат контакт. */
export function AwardContactBubble() {
  const { auth, t } = useApp()
  const [award, setAward] = useState(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ contactName: '', contactPhone: '', contactEmail: '', contactNote: '' })

  useEffect(() => {
    if (!auth.email || auth.isAnonymous) {
      setAward(null)
      return undefined
    }
    let cancelled = false
    fetchMyLeaderboardAward(auth.email)
      .then((row) => {
        if (cancelled) return
        setAward(row)
        if (row) {
          setForm((f) => ({
            ...f,
            contactName: auth.displayName || '',
            contactEmail: auth.email || '',
          }))
        }
      })
      .catch(() => { if (!cancelled) setAward(null) })
    return () => { cancelled = true }
  }, [auth.email, auth.isAnonymous, auth.displayName])

  if (!award || done) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await submitLeaderboardAwardContactApi(award.id, {
        email: auth.email,
        ...form,
      })
      setDone(true)
      setOpen(false)
      setAward(null)
    } catch (err) {
      setError(err?.message || t('lead.awardContactFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='pointer-events-none fixed bottom-20 right-4 z-[1100] flex flex-col items-end gap-2 sm:bottom-6'>
      {open && (
        <div className='pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-amber-200 bg-white p-4 shadow-xl'>
          <div className='mb-3 flex items-start justify-between gap-2'>
            <div>
              <p className='text-sm font-bold text-slate-900'>
                {t('lead.awardBubbleTitle', { place: award.place })}
              </p>
              <p className='mt-1 text-xs text-slate-500'>{award.message}</p>
            </div>
            <button type='button' onClick={() => setOpen(false)} className='rounded-lg p-1 text-slate-400 hover:bg-slate-100' aria-label={t('common.close')}>
              <X className='h-4 w-4' />
            </button>
          </div>
          <p className='mb-2 text-xs text-slate-600'>{t('lead.awardContactHint')}</p>
          <form onSubmit={handleSubmit} className='space-y-2'>
            <input
              required
              maxLength={120}
              value={form.contactName}
              onChange={(ev) => setForm((f) => ({ ...f, contactName: ev.target.value }))}
              placeholder={t('lead.awardContactName')}
              className='w-full rounded-xl border border-slate-200 px-3 py-2 text-sm'
            />
            <input
              required
              maxLength={40}
              value={form.contactPhone}
              onChange={(ev) => setForm((f) => ({ ...f, contactPhone: ev.target.value }))}
              placeholder={t('lead.awardContactPhone')}
              className='w-full rounded-xl border border-slate-200 px-3 py-2 text-sm'
            />
            <input
              type='email'
              maxLength={120}
              value={form.contactEmail}
              onChange={(ev) => setForm((f) => ({ ...f, contactEmail: ev.target.value }))}
              placeholder={t('lead.awardContactEmail')}
              className='w-full rounded-xl border border-slate-200 px-3 py-2 text-sm'
            />
            <textarea
              maxLength={300}
              rows={2}
              value={form.contactNote}
              onChange={(ev) => setForm((f) => ({ ...f, contactNote: ev.target.value }))}
              placeholder={t('lead.awardContactNote')}
              className='w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm'
            />
            {error && <p className='text-xs text-rose-600'>{error}</p>}
            <Button type='submit' className='w-full' disabled={busy}>
              {busy ? '…' : t('lead.awardContactSubmit')}
            </Button>
          </form>
        </div>
      )}

      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='pointer-events-auto flex items-center gap-2 rounded-full border border-amber-300 bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-amber-600'
      >
        <Gift className='h-4 w-4' />
        {t('lead.awardBubbleCta')}
      </button>
    </div>
  )
}
