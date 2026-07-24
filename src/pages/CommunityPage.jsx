import { Bell, CalendarDays, ChevronLeft, Clock, Loader2, MapPin, Trash2, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { InstagramIcon } from '../components/InstagramIcon'
import { useLocation, useNavigate } from 'react-router-dom'
import { CenteredOverlay } from '../components/CenteredOverlay'
import { EmptyState } from '../components/EmptyState'
import { EventDatePicker } from '../components/EventDatePicker'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { useApp } from '../context/AppContext'
import { createEventApi, deleteEventApi, fetchEventSignupsApi, leaveEventApi, sendEventReminderApi, signupEventApi } from '../lib/api'
import { loginNavState } from '../lib/authNav'
import { formatDisplayDate, isTodayOrFuture, todayIso } from '../lib/dates'
import { instagramProfileUrl, normalizeInstagramHandle } from '../lib/instagram'

const STATUS_META = {
  open:     { key: 'event.open',    cls: 'bg-emerald-100 text-emerald-700' },
  few_left: { key: 'event.fewLeft', cls: 'bg-orange-100 text-orange-700' },
  closed:   { key: 'event.closed',  cls: 'bg-slate-100 text-slate-500' },
}

// Локален датум YYYY-MM-DD (без UTC поместување, точно за Скопје).
function todayStr() {
  return todayIso()
}

function EventBadge({ status }) {
  const { t } = useApp()
  const m = STATUS_META[status] || STATUS_META.open
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.cls}`}>{t(m.key)}</span>
}

function TimeBadge({ kind }) {
  const { t } = useApp()
  if (kind === 'today') return <span className='rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700'>{t('comm.today')}</span>
  if (kind === 'past') return <span className='rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500'>{t('comm.passed')}</span>
  return null
}

function InstagramLink({ handle, className = '' }) {
  const h = normalizeInstagramHandle(handle)
  const url = instagramProfileUrl(h)
  if (!url) return null
  return (
    <a
      href={url}
      target='_blank'
      rel='noreferrer'
      className={`inline-flex items-center gap-1 font-semibold text-pink-600 hover:text-pink-700 ${className}`}
    >
      <InstagramIcon className='h-3.5 w-3.5 shrink-0' />
      @{h}
    </a>
  )
}

function SignUpModal({ event, onClose, onConfirm }) {
  const { auth, t } = useApp()
  const [form, setForm] = useState({
    name: auth.displayName || '',
    email: auth.email || '',
    note: '',
  })
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError(t('comm.enterName'))
    onConfirm(form)
  }

  return (
    <CenteredOverlay
      open
      onClose={onClose}
      labelledBy='signup-modal-title'
      panelClassName='text-left'
    >
      <div className='mb-5 flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h3 id='signup-modal-title' className='text-lg font-bold text-slate-900'>{t('comm.signupTitle')}</h3>
          <p className='mt-0.5 text-sm text-slate-500'>{event.title}</p>
        </div>
        <button
          type='button'
          aria-label={t('common.close')}
          onClick={onClose}
          className='shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100'
        >
          <X className='h-4 w-4' />
        </button>
      </div>
      <form onSubmit={submit} className='space-y-3'>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('comm.namePlaceholder')} />
        <Input type='email' value={form.email} disabled placeholder={t('comm.emailPlaceholder')} />
        <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t('comm.notePlaceholder')} className='min-h-16' />
        {error && <p className='text-sm text-rose-600'>{error}</p>}
        <div className='flex gap-2 pt-1'>
          <Button type='button' variant='outline' className='flex-1' onClick={onClose}>{t('comm.cancel')}</Button>
          <Button type='submit' className='flex-1'>{t('comm.confirmSignup')}</Button>
        </div>
      </form>
    </CenteredOverlay>
  )
}

function EventSignupsPanel({ eventId, organizerEmail }) {
  const { t } = useApp()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!eventId || !organizerEmail || String(eventId).startsWith('local-')) {
      setRows([])
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    fetchEventSignupsApi(eventId, organizerEmail)
      .then((data) => { if (!cancelled) setRows(Array.isArray(data) ? data : []) })
      .catch((err) => { if (!cancelled) setError(err.message || t('comm.signupsLoadFailed')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [eventId, organizerEmail, t])

  return (
    <div className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
      <p className='mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900'>
        <Users className='h-4 w-4 text-emerald-600' />{t('comm.signupsTitle')}
      </p>
      {loading ? (
        <p className='flex items-center gap-2 text-sm text-slate-500'><Loader2 className='h-4 w-4 animate-spin' />{t('comm.signupsLoading')}</p>
      ) : error ? (
        <p className='text-sm text-rose-600'>{error}</p>
      ) : rows.length === 0 ? (
        <p className='text-sm text-slate-500'>{t('comm.signupsEmpty')}</p>
      ) : (
        <ul className='divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white'>
          {rows.map((row, idx) => (
            <li key={`${row.email}-${idx}`} className='px-3 py-2.5 text-sm'>
              <p className='font-semibold text-slate-900'>{row.fullName || row.email}</p>
              <p className='text-xs text-slate-500'>{row.email}</p>
              {row.note && <p className='mt-1 text-xs text-slate-600'>{row.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReminderModal({ event, onClose, onSent }) {
  const { auth, t } = useApp()
  const [message, setMessage] = useState(event.reminderMessage || '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    const text = message.trim()
    if (!text) return setError(t('comm.reminderNoMessage'))
    if (String(event.id).startsWith('local-')) return setError(t('comm.eventStillSaving'))
    setSending(true)
    setError('')
    try {
      const result = await sendEventReminderApi(event.id, { email: auth.email, message: text })
      onSent(result?.sent ?? 0, text)
    } catch (err) {
      setError(err.message || t('comm.reminderFailed'))
      setSending(false)
    }
  }

  return (
    <CenteredOverlay open onClose={onClose} labelledBy='reminder-title' panelClassName='text-left'>
      <div className='mb-4 flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h2 id='reminder-title' className='text-lg font-bold text-slate-900'>{t('comm.reminderSendTitle')}</h2>
          <p className='mt-1 text-sm text-slate-500'>{event.title}</p>
        </div>
        <button type='button' onClick={onClose} className='shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700' aria-label={t('comm.cancel')}>
          <X className='h-5 w-5' />
        </button>
      </div>
      <p className='mb-3 text-sm text-slate-600'>{t('comm.reminderSendHint')}</p>
      <form onSubmit={submit} className='space-y-3'>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('comm.reminderMessagePh')}
          className='min-h-28'
          maxLength={500}
          required
        />
        {error && <p className='text-sm text-rose-600'>{error}</p>}
        <div className='flex gap-2 pt-1'>
          <Button type='button' variant='outline' className='flex-1' onClick={onClose} disabled={sending}>{t('comm.cancel')}</Button>
          <Button type='submit' className='flex-1' disabled={sending}>
            {sending ? <Loader2 className='mr-1.5 h-4 w-4 animate-spin' /> : <Bell className='mr-1.5 h-4 w-4' />}
            {t('comm.sendReminder')}
          </Button>
        </div>
      </form>
    </CenteredOverlay>
  )
}

function EventDetailPage({ event, past, canManage, isOrganizer, organizerEmail, onBack, onSignUp, onCancelEvent, onSendReminder }) {
  const { t } = useApp()
  const displayDate = formatDisplayDate(event.date)
  const meta = [
    { icon: CalendarDays, label: t('comm.date'), value: displayDate },
    ...(event.time ? [{ icon: Clock, label: t('comm.time'), value: event.time }] : []),
    { icon: MapPin, label: t('comm.location'), value: event.location || t('comm.defaultLocation') },
    { icon: Users, label: t('comm.signedUp'), value: event.signupCount ?? 0 },
  ]
  return (
    <div className='space-y-5'>
      <button onClick={onBack} className='flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800'>
        <ChevronLeft className='h-4 w-4' />{t('comm.backToEvents')}
      </button>

      <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${past ? 'opacity-80' : ''}`}>
        <div className='border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-6 py-5'>
          <div className='flex flex-wrap items-start justify-between gap-2'>
            <h1 className='text-2xl font-bold text-slate-900 leading-snug'>{event.title}</h1>
            <div className='flex items-center gap-2'>
              <TimeBadge kind={past ? 'past' : event.isToday ? 'today' : null} />
              <EventBadge status={event.status} />
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
            <p className='text-sm text-slate-500'>
              {t('comm.organizer')} <span className='font-medium text-slate-700'>{event.organizer}</span>
            </p>
            {event.organizerInstagram && <InstagramLink handle={event.organizerInstagram} className='text-sm' />}
          </div>
        </div>

        <div className='px-6 py-5 space-y-4'>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            {meta.map(({ icon: Icon, label, value }) => (
              <div key={label} className='rounded-xl border border-slate-100 bg-slate-50 px-4 py-3'>
                <p className='flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400'>
                  <Icon className='h-3.5 w-3.5' />{label}
                </p>
                <p className='mt-1 text-sm font-semibold text-slate-800'>{value}</p>
              </div>
            ))}
          </div>

          {(event.description) && (
            <p className='text-sm leading-relaxed text-slate-600'>{event.description}</p>
          )}

          {!past && !isOrganizer && (
            <div className='flex flex-col gap-2 pt-1 sm:flex-row'>
              <Button className='flex-1' onClick={() => onSignUp(event)}>
                {event.joined ? t('comm.cancelSignup') : t('comm.signupEvent')}
              </Button>
            </div>
          )}

          {!past && !isOrganizer && event.joined && (
            <p className='rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800'>
              {t('comm.reminder24hInfo')}
            </p>
          )}

          {isOrganizer && (
            <>
              {!past && (
                <p className='rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700'>
                  {t('comm.organizerCannotSignup')}
                </p>
              )}
              {!past && (
                <Button className='w-full' onClick={() => onSendReminder(event)}>
                  <Bell className='mr-1.5 h-4 w-4' />{t('comm.sendReminder')}
                </Button>
              )}
              <EventSignupsPanel eventId={event.id} organizerEmail={organizerEmail} />
            </>
          )}

          {canManage && (
            <Button
              variant='outline'
              className='w-full border-rose-200 text-rose-600 hover:bg-rose-50'
              onClick={() => onCancelEvent(event)}
            >
              <Trash2 className='mr-1.5 h-4 w-4' />{t('comm.cancelEvent')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function FormField({ label, htmlFor, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className='mb-1.5 block text-sm font-medium text-slate-700'>
        {label}
      </label>
      {children}
    </div>
  )
}

export function CommunityPage() {
  const { events, setEvents, auth, pushNotification, refreshEvents, refreshData, t } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [toast, setToast] = useState('')
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', location: '', description: '', reminderMessage: '' })
  const [signUpEvent, setSignUpEvent] = useState(null)
  const [detailEvent, setDetailEvent] = useState(null)
  const [reminderEvent, setReminderEvent] = useState(null)
  const [showPast, setShowPast] = useState(false)

  // На Community страницата настаните се освежуваат побрзо (8s) — не чекаат 15s poll.
  useEffect(() => {
    refreshEvents()
    const timer = setInterval(refreshEvents, 8000)
    return () => clearInterval(timer)
  }, [refreshEvents])

  const today = todayStr()
  // Претстојни (денес и понатаму) наспроти изминати акции.
  const upcoming = events.filter((e) => (e.date || '') >= today)
  const past = events.filter((e) => (e.date || '') < today)

  // Организаторот на настанот или админ може да го откаже (исчезнува за сите).
  function canManage(event) {
    if (auth.isAnonymous) return false
    if (auth.role === 'admin') return true
    const orgEmail = (event.organizerEmail || event.organizer || '').toLowerCase()
    return Boolean(auth.email && orgEmail === auth.email.toLowerCase())
  }

  function isOrganizer(event) {
    if (!auth.email || auth.isAnonymous) return false
    const orgEmail = (event.organizerEmail || event.organizer || '').toLowerCase()
    return orgEmail === auth.email.toLowerCase()
  }

  function requireRegistered() {
    if (auth.isAnonymous) { navigate('/login', { state: loginNavState(location.pathname) }); return false }
    return true
  }

  function openSignUp(event) {
    if (!requireRegistered()) return
    if (isOrganizer(event)) return setToast(t('comm.organizerCannotSignup'))
    if (String(event.id).startsWith('local-')) return setToast(t('comm.eventStillSaving'))
    setSignUpEvent(event)
  }

  async function confirmSignUp(form) {
    const target = signUpEvent
    if (!target) return
    if (isOrganizer(target)) {
      setToast(t('comm.organizerCannotSignup'))
      setSignUpEvent(null)
      return
    }
    if (String(target.id).startsWith('local-')) {
      setToast(t('comm.eventStillSaving'))
      setSignUpEvent(null)
      return
    }
    try {
      await signupEventApi(target.id, { email: auth.email, fullName: form.name.trim() || auth.displayName, note: form.note })
      setEvents((prev) => prev.map((e) => (
        e.id === target.id
          ? { ...e, joined: true, signupCount: (e.signupCount ?? 0) + (e.joined ? 0 : 1) }
          : e
      )))
      pushNotification({ title: t('comm.signupConfirmed'), body: t('comm.signedUpFor', { title: target.title }) })
      setToast(t('comm.signupSuccess', { title: target.title }))
      setSignUpEvent(null)
      refreshEvents()
    } catch (err) {
      const msg = err.message === 'ORGANIZER_CANNOT_SIGNUP' ? t('comm.organizerCannotSignup') : (err.message || t('comm.signupFailed'))
      setToast(msg)
      setSignUpEvent(null)
    }
  }

  function leaveEvent(id) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, joined: false, signupCount: Math.max(0, (e.signupCount ?? 1) - 1) } : e)))
    if (auth.email) {
      leaveEventApi(id, auth.email)
        .then(() => {
          refreshEvents()
          refreshData()
        })
        .catch(() => {})
    }
    setToast(t('comm.leftEvent'))
  }

  function cancelEvent(event) {
    if (!window.confirm(t('comm.confirmCancelEvent'))) return
    setEvents((prev) => prev.filter((e) => e.id !== event.id))
    // Оптимистичките (уште неснимени) настани имаат `local-` id → нема што да се брише на сервер.
    if (!String(event.id).startsWith('local-')) {
      deleteEventApi(event.id, auth.email)
        .then(() => refreshEvents())
        .catch(() => {})
    }
    setDetailEvent(null)
    setToast(t('comm.eventCancelled'))
  }

  async function createEvent(e) {
    e.preventDefault()
    if (!newEvent.title || !newEvent.date || !newEvent.time || !newEvent.location || !newEvent.description) {
      return setToast(t('comm.fillAll'))
    }
    const iso = newEvent.date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return setToast(t('comm.invalidDate'))
    if (!isTodayOrFuture(iso)) return setToast(t('comm.pastDateNotAllowed'))
    if (!/^\d{2}:\d{2}$/.test(newEvent.time)) return setToast(t('comm.invalidTime'))

    const tempId = `local-${Date.now()}`
    const optimistic = {
      id: tempId, title: newEvent.title, date: iso, time: newEvent.time, status: 'open', signupCount: 0, joined: false,
      organizer: auth.displayName || auth.email || t('comm.orgFallback'),
      organizerEmail: auth.email || null,
      location: newEvent.location, description: newEvent.description,
      reminderMessage: newEvent.reminderMessage.trim(),
    }
    setEvents((prev) => [optimistic, ...prev])
    try {
      const created = await createEventApi({
        title: newEvent.title, description: newEvent.description, date: iso, time: newEvent.time,
        location: newEvent.location, reminderMessage: newEvent.reminderMessage.trim() || null,
        organizerEmail: auth.email, organizerName: auth.displayName || auth.email,
      })
      setEvents((prev) => prev.map((ev) => (
        ev.id === tempId ? { ...created, organizerEmail: auth.email || created.organizerEmail } : ev
      )))
      setNewEvent({ title: '', date: '', time: '', location: '', description: '', reminderMessage: '' })
      setToast(t('comm.eventCreated'))
      refreshEvents()
    } catch (err) {
      setEvents((prev) => prev.filter((ev) => ev.id !== tempId))
      setToast(err.message || t('comm.eventCreateFailed'))
    }
  }

  function renderEventRow(event, isPast) {
    const isToday = event.date === today
    const accent = isPast ? 'bg-slate-300' : event.status === 'few_left' ? 'bg-orange-400' : event.status === 'closed' ? 'bg-slate-300' : 'bg-emerald-500'
    const organizerOwns = isOrganizer(event)
    return (
      <div
        key={event.id}
        className={`flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md ${isPast ? 'opacity-70' : ''}`}
      >
        <div className={`w-1.5 shrink-0 ${accent}`} />
        <div className='flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5'>
          <div className='flex-1 min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <p className='font-semibold text-slate-900'>{event.title}</p>
              {isPast ? <TimeBadge kind='past' /> : isToday ? <TimeBadge kind='today' /> : <EventBadge status={event.status} />}
              {!isPast && event.joined && <span className='rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700'>{t('comm.joined')}</span>}
              {!isPast && organizerOwns && <span className='rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700'>{t('comm.organizerBadge')}</span>}
            </div>
            <div className='mt-1.5 flex flex-wrap gap-x-4 gap-y-1'>
              <span className='flex items-center gap-1.5 text-xs text-slate-500'><CalendarDays className='h-3.5 w-3.5' />{formatDisplayDate(event.date)}</span>
              {event.time && <span className='flex items-center gap-1.5 text-xs text-slate-500'><Clock className='h-3.5 w-3.5' />{event.time}</span>}
              <span className='flex items-center gap-1.5 text-xs text-slate-500'><MapPin className='h-3.5 w-3.5' />{event.location || t('comm.skopje')}</span>
              <span className='flex items-center gap-1.5 text-xs text-slate-500'><Users className='h-3.5 w-3.5' />{event.signupCount ?? 0} {t('comm.signedUpWord')}</span>
              {event.organizerInstagram && (
                <InstagramLink handle={event.organizerInstagram} className='text-xs' />
              )}
            </div>
          </div>

          <div className='flex shrink-0 flex-wrap gap-2' onClick={(e) => e.stopPropagation()}>
            {!isPast && !organizerOwns && (event.joined ? (
              <Button size='sm' variant='outline' className='border-rose-200 text-rose-600 hover:bg-rose-50' onClick={() => leaveEvent(event.id)}>{t('comm.cancel')}</Button>
            ) : (
              <Button size='sm' onClick={() => openSignUp(event)}>{t('comm.signup')}</Button>
            ))}
            <Button size='sm' variant='outline' onClick={() => setDetailEvent(event)}>{t('comm.details')}</Button>
            {canManage(event) && (
              <Button size='sm' variant='outline' className='border-rose-200 text-rose-600 hover:bg-rose-50' onClick={() => cancelEvent(event)} aria-label={t('comm.cancelEvent')}>
                <Trash2 className='h-4 w-4' />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (detailEvent) {
    const live = events.find((e) => e.id === detailEvent.id) || detailEvent
    const isPast = (live.date || '') < today
    return (
      <>
        <EventDetailPage
          event={{ ...live, isToday: live.date === today }}
          past={isPast}
          canManage={canManage(live)}
          isOrganizer={isOrganizer(live)}
          organizerEmail={auth.email || ''}
          onBack={() => setDetailEvent(null)}
          onSignUp={(ev) => live.joined ? leaveEvent(ev.id) : openSignUp(ev)}
          onCancelEvent={cancelEvent}
          onSendReminder={(ev) => setReminderEvent(ev)}
        />
        {signUpEvent && <SignUpModal event={signUpEvent} onClose={() => setSignUpEvent(null)} onConfirm={confirmSignUp} />}
        {reminderEvent && (
          <ReminderModal
            event={reminderEvent}
            onClose={() => setReminderEvent(null)}
            onSent={(count, message) => {
              setEvents((prev) => prev.map((e) => (e.id === reminderEvent.id ? { ...e, reminderMessage: message } : e)))
              setReminderEvent(null)
              setToast(t('comm.reminderSent', { count }))
              refreshData()
            }}
          />
        )}
        <Toast toast={toast} onClose={() => setToast('')} />
      </>
    )
  }

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold text-slate-900'>{t('comm.title')}</h1>
        <p className='mt-0.5 text-sm text-slate-500'>{t('comm.subtitle')}</p>
      </div>

      {/* Претстојни акции */}
      <div>
        <h2 className='mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500'>{t('comm.upcomingTitle')}</h2>
        {upcoming.length === 0 ? (
          <EmptyState title={t('comm.noUpcoming')} description={t('comm.subtitle')} />
        ) : (
          <div className='space-y-3'>
            {upcoming.map((event) => renderEventRow(event, false))}
          </div>
        )}
      </div>

      {/* Изминати акции (се прикажуваат како „Помина“) */}
      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast((v) => !v)}
            className='mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600'
          >
            {t('comm.pastTitle')} ({past.length}) · {showPast ? t('comm.hidePast') : t('comm.showPast')}
          </button>
          {showPast && (
            <div className='space-y-3'>
              {past.map((event) => renderEventRow(event, true))}
            </div>
          )}
        </div>
      )}
      {auth.role === 'organization' && (
        <Card>
          <CardHeader className='pb-3'><CardTitle>{t('comm.createEvent')}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={createEvent} className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField label={t('comm.eventTitlePlaceholder')} htmlFor='event-title' className='sm:col-span-2'>
                  <Input
                    id='event-title'
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder={t('comm.eventTitlePlaceholder')}
                    className='h-11'
                    required
                  />
                </FormField>
                <FormField label={t('comm.date')} htmlFor='event-date'>
                  <EventDatePicker
                    id='event-date'
                    size='lg'
                    value={newEvent.date}
                    min={today}
                    onChange={(date) => setNewEvent({ ...newEvent, date })}
                  />
                </FormField>
                <FormField label={t('comm.time')} htmlFor='event-time'>
                  <Input
                    id='event-time'
                    type='time'
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className='h-11'
                    required
                  />
                </FormField>
                <FormField label={t('comm.location')} htmlFor='event-location'>
                  <Input
                    id='event-location'
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    placeholder={t('comm.locationPlaceholder')}
                    className='h-11'
                    required
                  />
                </FormField>
                <FormField label={t('comm.organizer')} htmlFor='event-organizer'>
                  <Input
                    id='event-organizer'
                    value={auth.email || ''}
                    disabled
                    placeholder={t('comm.organizerPlaceholder')}
                    className='h-11 bg-slate-50 text-slate-500'
                  />
                </FormField>
              </div>
              <FormField label={t('comm.descriptionLabel')} htmlFor='event-description'>
                <Textarea
                  id='event-description'
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder={t('comm.descPlaceholder')}
                  className='min-h-28'
                />
              </FormField>
              <FormField label={t('comm.reminderMessage')} htmlFor='event-reminder'>
                <Textarea
                  id='event-reminder'
                  value={newEvent.reminderMessage}
                  onChange={(e) => setNewEvent({ ...newEvent, reminderMessage: e.target.value })}
                  placeholder={t('comm.reminderMessagePh')}
                  className='min-h-24'
                  maxLength={500}
                />
              </FormField>
              <Button type='submit' className='w-full sm:w-auto'>{t('comm.create')}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {signUpEvent && <SignUpModal event={signUpEvent} onClose={() => setSignUpEvent(null)} onConfirm={confirmSignUp} />}
      <Toast toast={toast} onClose={() => setToast('')} />
    </div>
  )
}
