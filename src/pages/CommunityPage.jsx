import { CalendarDays, ChevronLeft, MapPin, Trash2, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { useApp } from '../context/AppContext'
import { createEventApi, deleteEventApi, leaveEventApi, signupEventApi } from '../lib/api'

const STATUS_META = {
  open:     { key: 'event.open',    cls: 'bg-emerald-100 text-emerald-700' },
  few_left: { key: 'event.fewLeft', cls: 'bg-orange-100 text-orange-700' },
  closed:   { key: 'event.closed',  cls: 'bg-slate-100 text-slate-500' },
}

// Локален датум YYYY-MM-DD (без UTC поместување, точно за Скопје).
function todayStr() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
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

function SignUpModal({ event, onClose, onConfirm }) {
  const { t } = useApp()
  const [form, setForm] = useState({ name: '', email: '', note: '' })
  const [error, setError] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!form.name.trim()) return setError(t('comm.enterName'))
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError(t('comm.enterValidEmail'))
    onConfirm(form)
  }

  return (
    <div className='fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center'>
      <div className='w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl'>
        <div className='mb-5 flex items-start justify-between'>
          <div>
            <h3 className='text-lg font-bold text-slate-900'>{t('comm.signupTitle')}</h3>
            <p className='mt-0.5 text-sm text-slate-500'>{event.title}</p>
          </div>
          <button onClick={onClose} className='rounded-lg p-1.5 text-slate-400 hover:bg-slate-100'><X className='h-4 w-4' /></button>
        </div>
        <form onSubmit={submit} className='space-y-3'>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('comm.namePlaceholder')} />
          <Input type='email' value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t('comm.emailPlaceholder')} />
          <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t('comm.notePlaceholder')} className='min-h-16' />
          {error && <p className='text-sm text-rose-600'>{error}</p>}
          <div className='flex gap-2 pt-1'>
            <Button type='button' variant='outline' className='flex-1' onClick={onClose}>{t('comm.cancel')}</Button>
            <Button type='submit' className='flex-1'>{t('comm.confirmSignup')}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EventDetailPage({ event, past, canManage, onBack, onSignUp, onNotify, onCancelEvent }) {
  const { t } = useApp()
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
          <p className='mt-1 text-sm text-slate-500'>{t('comm.organizer')} <span className='font-medium text-slate-700'>{event.organizer}</span></p>
        </div>

        <div className='px-6 py-5 space-y-4'>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
            {[
              { icon: CalendarDays, label: t('comm.date'), value: event.date },
              { icon: MapPin, label: t('comm.location'), value: event.location || t('comm.defaultLocation') },
              { icon: Users, label: t('comm.signedUp'), value: event.signupCount ?? 0 },
            ].map(({ icon: Icon, label, value }) => (
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

          {!past && (
            <div className='flex flex-col gap-2 pt-1 sm:flex-row'>
              <Button className='flex-1' onClick={() => onSignUp(event)}>
                {event.joined ? t('comm.cancelSignup') : t('comm.signupEvent')}
              </Button>
              <Button variant='outline' onClick={() => onNotify(event)}>{t('comm.notifyMe')}</Button>
            </div>
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

export function CommunityPage() {
  const { events, setEvents, auth, pushNotification, t } = useApp()
  const navigate = useNavigate()
  const [toast, setToast] = useState('')
  const [newEvent, setNewEvent] = useState({ title: '', date: '', location: '', description: '' })
  const [signUpEvent, setSignUpEvent] = useState(null)
  const [detailEvent, setDetailEvent] = useState(null)
  const [showPast, setShowPast] = useState(false)

  const today = todayStr()
  // Претстојни (денес и понатаму) наспроти изминати акции.
  const upcoming = events.filter((e) => (e.date || '') >= today)
  const past = events.filter((e) => (e.date || '') < today)

  // Организаторот на настанот или админ може да го откаже (исчезнува за сите).
  function canManage(event) {
    if (auth.isAnonymous) return false
    if (auth.role === 'admin') return true
    return Boolean(auth.email && event.organizer && event.organizer.toLowerCase() === auth.email.toLowerCase())
  }

  function requireRegistered() {
    if (auth.isAnonymous) { navigate('/login', { state: { allowLogin: true } }); return false }
    return true
  }

  function openSignUp(event) {
    if (!requireRegistered()) return
    setSignUpEvent(event)
  }

  function confirmSignUp(form) {
    const target = signUpEvent
    setEvents((prev) => prev.map((e) => (e.id === target.id ? { ...e, joined: true } : e)))
    signupEventApi(target.id, { email: auth.email, fullName: form.name, note: form.note }).catch(() => {})
    pushNotification({ title: t('comm.signupConfirmed'), body: t('comm.signedUpFor', { title: target.title }) })
    setToast(t('comm.signupSuccess', { title: target.title }))
    setSignUpEvent(null)
  }

  function leaveEvent(id) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, joined: false } : e)))
    if (auth.email) leaveEventApi(id, auth.email).catch(() => {})
    setToast(t('comm.leftEvent'))
  }

  function notifyMe(event) {
    if (!requireRegistered()) return
    pushNotification({ title: t('comm.eventReminder'), body: t('comm.willRemind', { title: event.title }) })
    setToast(t('comm.willBeNotified'))
  }

  function cancelEvent(event) {
    if (!window.confirm(t('comm.confirmCancelEvent'))) return
    setEvents((prev) => prev.filter((e) => e.id !== event.id))
    // Оптимистичките (уште неснимени) настани имаат `local-` id → нема што да се брише на сервер.
    if (!String(event.id).startsWith('local-')) deleteEventApi(event.id, auth.email).catch(() => {})
    setDetailEvent(null)
    setToast(t('comm.eventCancelled'))
  }

  function createEvent(e) {
    e.preventDefault()
    if (!newEvent.title || !newEvent.date || !newEvent.location || !newEvent.description) return setToast(t('comm.fillAll'))
    const optimistic = { id: `local-${Date.now()}`, title: newEvent.title, date: newEvent.date, status: 'open', signupCount: 0, joined: false, organizer: auth.email || t('comm.orgFallback'), location: newEvent.location, description: newEvent.description }
    setEvents((prev) => [optimistic, ...prev])
    createEventApi({
      title: newEvent.title, description: newEvent.description, date: newEvent.date,
      location: newEvent.location, organizerEmail: auth.email, organizerName: auth.email,
    }).catch(() => {})
    setNewEvent({ title: '', date: '', location: '', description: '' })
    setToast(t('comm.eventCreated'))
  }

  function renderEventRow(event, isPast) {
    const isToday = event.date === today
    const accent = isPast ? 'bg-slate-300' : event.status === 'few_left' ? 'bg-orange-400' : event.status === 'closed' ? 'bg-slate-300' : 'bg-emerald-500'
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
            </div>
            <div className='mt-1.5 flex flex-wrap gap-x-4 gap-y-1'>
              <span className='flex items-center gap-1.5 text-xs text-slate-500'><CalendarDays className='h-3.5 w-3.5' />{event.date}</span>
              <span className='flex items-center gap-1.5 text-xs text-slate-500'><MapPin className='h-3.5 w-3.5' />{event.location || t('comm.skopje')}</span>
              <span className='flex items-center gap-1.5 text-xs text-slate-500'><Users className='h-3.5 w-3.5' />{event.signupCount ?? 0} {t('comm.signedUpWord')}</span>
            </div>
          </div>

          <div className='flex shrink-0 flex-wrap gap-2' onClick={(e) => e.stopPropagation()}>
            {!isPast && (event.joined ? (
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
          onBack={() => setDetailEvent(null)}
          onSignUp={(ev) => live.joined ? leaveEvent(ev.id) : openSignUp(ev)}
          onNotify={notifyMe}
          onCancelEvent={cancelEvent}
        />
        {signUpEvent && <SignUpModal event={signUpEvent} onClose={() => setSignUpEvent(null)} onConfirm={confirmSignUp} />}
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
              <div className='grid gap-3 sm:grid-cols-2'>
                <Input value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} placeholder={t('comm.eventTitlePlaceholder')} />
                <Input type='date' value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} />
                <Input value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} placeholder={t('comm.locationPlaceholder')} />
                <Input value={auth.email || ''} disabled placeholder={t('comm.organizerPlaceholder')} />
              </div>
              <Textarea value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} placeholder={t('comm.descPlaceholder')} className='min-h-24' />
              <Button className='w-full sm:w-auto'>{t('comm.create')}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {signUpEvent && <SignUpModal event={signUpEvent} onClose={() => setSignUpEvent(null)} onConfirm={confirmSignUp} />}
      <Toast toast={toast} onClose={() => setToast('')} />
    </div>
  )
}
