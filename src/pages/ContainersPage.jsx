import { Ban, CheckCircle2, ClipboardList, MapPin, Package, PackageCheck, Phone, Recycle, Sofa, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ReportShortcutButton } from '../components/ReportShortcutButton'
import { ResolvedReportsPager } from '../components/ResolvedReportsPager'
import { StatusUpdateSuccessModal } from '../components/StatusUpdateSuccessModal'
import { StatusBadge } from '../components/StatusBadge'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'
import { updateReportStatus } from '../lib/api'
import { containerKinds } from '../data/catalog'
import { getDeviceId } from '../lib/device'
import { isNativePlatform } from '../lib/notifications'
import { isMyReport } from '../lib/reportOwnership'
import { canAccessReportType } from '../lib/roles'

const BULKY_PHONE_DISPLAY = '080 022233'
const BULKY_PHONE_TEL = '080022233'

const kindColor = Object.fromEntries(containerKinds.map((k) => [k.id, k.color]))

function mkDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('mk-MK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function ContainersPage() {
  const { containers, setContainers, auth, refreshReports, noteReportsChanged, t } = useApp()
  const containerKindLabel = (id) => t(`containerKind.${id || 'mesan'}`)
  const [toast, setToast] = useState('')
  const [statusSuccess, setStatusSuccess] = useState(null)

  useEffect(() => {
    refreshReports()
  }, [refreshReports])

  const isContainerAdmin = canAccessReportType(auth.role, 'container')
  const myActiveReports = useMemo(() => {
    const open = containers.filter((c) => c.issueOpen)
    if (isContainerAdmin) return open
    return open.filter((c) => isMyReport(c, auth, getDeviceId()))
  }, [containers, isContainerAdmin, auth.email, auth.userId, auth.isAnonymous])

  async function callBulkyLine() {
    if (isNativePlatform()) {
      window.location.href = `tel:${BULKY_PHONE_TEL}`
      return
    }
    try {
      await navigator.clipboard.writeText(BULKY_PHONE_DISPLAY)
      setToast(t('cont.phoneCopied', { phone: BULKY_PHONE_DISPLAY }))
    } catch {
      setToast(t('cont.phoneCallManual', { phone: BULKY_PHONE_DISPLAY }))
    }
  }

  const pointTypeLabel = (type) => (type === 'waste_basket' ? t('cont.publicBasket') : t('cont.recyclingContainer'))
  function NearestPoint({ c }) {
    if (c.lat == null && c.nearestPointId == null) return null
    if (!c.nearestPointId) {
      return <p className='mt-1 text-xs text-slate-400'>{t('cont.nearestUnknown')}</p>
    }
    return (
      <p className='mt-1 text-xs text-slate-500'>
        {t('cont.nearestPoint')}: <span className='font-medium text-slate-700'>{pointTypeLabel(c.nearestPointType)}</span>
        {' '}<span className='text-slate-400'>{c.nearestPointId}</span>
        {c.nearestDistanceM != null ? ` · ${t('cont.metersAway', { n: c.nearestDistanceM })}` : ''}
      </p>
    )
  }

  const activeContainerIssues = containers.filter((c) => c.issueOpen)
  const resolvedContainerReports = useMemo(
    () => containers.filter((c) => !c.issueOpen && (c.reportedBy || c.reportedById)),
    [containers],
  )

  async function resetIssue(id) {
    if (!(typeof id === 'string' && id.includes('-'))) return
    try {
      await updateReportStatus(id, 'resolved')
    } catch {
      return
    }
    const container = containers.find((c) => c.id === id)
    const loc = container?.area || t('admin.unknownLocation')
    const statusLabel = t('status.resolved')
    noteReportsChanged()
    setContainers((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        return {
          ...c,
          issue: 'none',
          issueOpen: false,
          resolvedRewardGiven: true,
          resolvedAt: new Date().toISOString(),
        }
      }),
    )
    setStatusSuccess({
      title: t('admin.statusUpdatedTitle', { status: statusLabel }),
      body: t('admin.statusUpdatedBody', { loc, status: statusLabel }),
    })
  }

  const careTips = [
    { icon: PackageCheck, color: 'bg-emerald-50 text-emerald-700', title: t('cont.careCloseLidTitle'), body: t('cont.careCloseLidBody') },
    { icon: Ban, color: 'bg-amber-50 text-amber-700', title: t('cont.careNoNextToTitle'), body: t('cont.careNoNextToBody') },
    { icon: Recycle, color: 'bg-sky-50 text-sky-700', title: t('cont.careRecycleTitle'), body: t('cont.careRecycleBody') },
    { icon: Package, color: 'bg-purple-50 text-purple-700', title: t('cont.careBulkyTitle'), body: t('cont.careBulkyBody') },
    { icon: Trash2, color: 'bg-rose-50 text-rose-700', title: t('cont.careReportTitle'), body: t('cont.careReportBody') },
  ]

  const stats = [
    { n: resolvedContainerReports.length, label: t('cont.statSolved'), hint: t('cont.statSolvedHint'), icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
    { n: activeContainerIssues.length, label: t('cont.statOpen'), hint: t('cont.statOpenHint'), icon: ClipboardList, color: 'bg-sky-50 text-sky-600' },
  ]

  return (
    <div className='space-y-7'>
      <div className='relative overflow-hidden rounded-b-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900 px-6 py-10 text-white sm:px-10 sm:py-12 -mx-4 sm:-mx-6 md:-mx-8 -mt-5'>
        <div className='pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl' />
        <div className='pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-purple-300/20 blur-3xl' />
        <div className='relative flex items-center justify-between gap-6'>
          <div>
            <div className='mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80'>
              <Sofa className='h-3 w-3' />{t('cont.newService')}
            </div>
            <h2 className='text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl'>
              {t('cont.bulkyTitle')}
            </h2>
            <p className='mt-3 max-w-md text-base text-slate-300'>
              {t('cont.bulkySubtitle')}
            </p>
            <div className='mt-6 flex flex-wrap gap-3'>
              <button
                type='button'
                onClick={callBulkyLine}
                className='flex items-center gap-2 rounded-xl bg-purple-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-purple-400'
              >
                <Phone className='h-4 w-4' />{t('cont.reportNow')} · {BULKY_PHONE_DISPLAY}
              </button>
              <button
                type='button'
                onClick={() => window.open('https://khigiena.com.mk/', '_blank')}
                className='flex items-center gap-2 rounded-xl border border-white/40 bg-white/15 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/25'
              >
                {t('cont.moreInfo')}
              </button>
            </div>
          </div>
          <Sofa className='relative hidden h-24 w-24 shrink-0 text-white/20 sm:block' />
        </div>
      </div>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-xl'>{t('cont.careTitle')}</CardTitle>
          <CardDescription className='mt-1'>{t('cont.careSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='grid gap-3 sm:grid-cols-2'>
            {stats.map((s) => (
              <div key={s.label} className='flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm'>
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${s.color}`}>
                  <s.icon className='h-5 w-5' />
                </span>
                <div className='min-w-0'>
                  <p className='text-2xl font-extrabold tabular-nums text-slate-900'>{s.n}</p>
                  <p className='text-sm font-semibold text-slate-700'>{s.label}</p>
                  <p className='text-xs text-slate-500'>{s.hint}</p>
                </div>
              </div>
            ))}
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            {careTips.map((tip) => (
              <article key={tip.title} className='rounded-2xl border border-slate-100 bg-slate-50/70 p-4'>
                <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl ${tip.color}`}>
                  <tip.icon className='h-4 w-4' />
                </div>
                <h3 className='text-sm font-bold text-slate-900'>{tip.title}</h3>
                <p className='mt-1 text-sm leading-relaxed text-slate-600'>{tip.body}</p>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className='space-y-4'>
        <div className='flex items-center justify-between gap-3'>
          <h2 className='text-xl font-bold text-slate-900'>{isContainerAdmin ? t('waste.activeAdmin') : t('waste.activeMine')}</h2>
          <span className='rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700'>
            {myActiveReports.length} {t('common.records')}
          </span>
        </div>
        {myActiveReports.length === 0 ? (
          <EmptyState
            title={isContainerAdmin ? t('waste.noActiveAdmin') : t('waste.noActiveMine')}
            description={isContainerAdmin ? t('waste.noActiveAdminDesc') : t('waste.noActiveMineDesc')}
          />
        ) : (
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {myActiveReports.map((c) => (
              <article key={c.id} className='group rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5'>
                <div className='flex items-start justify-between gap-2'>
                  <p className='flex items-center gap-2 font-semibold text-slate-900'>
                    <MapPin className='h-4 w-4 shrink-0 text-emerald-500' />
                    {c.area}
                  </p>
                  <StatusBadge status={c.status || 'pending'} />
                </div>
                {c.lat != null && (
                  <p className='mt-2 text-xs text-slate-400'>GPS: {Number(c.lat).toFixed(5)}, {Number(c.lng).toFixed(5)}</p>
                )}
                <NearestPoint c={c} />
                <div className='mt-3 space-y-1'>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${kindColor[c.kind] || 'bg-slate-100 text-slate-700'}`}>
                    {containerKindLabel(c.kind)}
                  </span>
                  <p className='text-sm text-slate-600'>
                    {t('cont.problem')} <span className='font-semibold text-slate-800'>{c.issue === 'full' ? t('cont.full') : c.issue === 'smell' ? t('cont.smell') : c.issue === 'broken' ? t('cont.broken') : c.issue}</span>
                  </p>
                  {c.description && <p className='text-sm text-slate-500'>{c.description}</p>}
                </div>
                <p className='mt-2 text-xs text-slate-400'>
                  {t('cont.reportedBy')} {c.reportedBy || t('common.anonymous')}{c.createdAt ? ` · ${mkDate(c.createdAt)}` : ''}
                </p>
                {isContainerAdmin && (
                  <div className='mt-4'>
                    <Button size='sm' className='w-full' onClick={() => resetIssue(c.id)}>
                      {t('cont.markResolved')}
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <ResolvedReportsPager
        title={t('cont.resolvedTitle')}
        subtitle={t('cont.resolvedSubtitle')}
        items={resolvedContainerReports}
        countLabel={t('cont.posts')}
        emptyTitle={t('cont.noResolved')}
        emptyDescription={t('cont.resolvedSubtitle')}
        t={t}
        renderItem={(c) => (
          <article key={c.id} className='rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-sm'>
            <div className='flex items-start justify-between gap-2'>
              <p className='flex items-center gap-2 font-semibold text-slate-900'>
                <MapPin className='h-4 w-4 shrink-0 text-emerald-500' />{c.area}
              </p>
              <span className='inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white'>
                <CheckCircle2 className='h-3 w-3' />{t('cont.solvedBadge')}
              </span>
            </div>
            <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${kindColor[c.kind] || 'bg-slate-100 text-slate-700'}`}>
              {containerKindLabel(c.kind)}
            </span>
            {c.description && <p className='mt-2 text-sm text-slate-600'>{c.description}</p>}
            <NearestPoint c={c} />
            <p className='mt-2 text-xs text-slate-400'>
              {t('cont.reportedBy')} {c.reportedBy || t('common.anonymousCitizen')}{c.resolvedAt || c.createdAt ? ` · ${mkDate(c.resolvedAt || c.createdAt)}` : ''}
            </p>
          </article>
        )}
      />

      <Card className='border-sky-100 bg-gradient-to-br from-white to-sky-50/40'>
        <CardHeader>
          <CardTitle className='text-lg'>{t('cont.reportCardTitle')}</CardTitle>
          <CardDescription>{t('cont.reportCardSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportShortcutButton reportType='container' className='w-full' />
        </CardContent>
      </Card>

      <Toast toast={toast} onClose={() => setToast('')} />
      <StatusUpdateSuccessModal
        open={!!statusSuccess}
        title={statusSuccess?.title}
        body={statusSuccess?.body}
        onClose={() => setStatusSuccess(null)}
      />
    </div>
  )
}
