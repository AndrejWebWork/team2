import { Camera, MapPin, UserRound } from 'lucide-react'
import { useMemo } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ReportShortcutButton } from '../components/ReportShortcutButton'
import { ResolvedReportsPager } from '../components/ResolvedReportsPager'
import { StatusBadge } from '../components/StatusBadge'
import { Toast } from '../components/Toast'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'
import { updateReportStatus } from '../lib/api'
import { getDeviceId } from '../lib/device'
import { isMyReport } from '../lib/reportOwnership'

function mkDate(iso, noDate) {
  if (!iso) return noDate
  return new Date(iso).toLocaleString('mk-MK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function WastePage() {
  const { wasteReports, setWasteReports, auth, awardPoints, t } = useApp()

  const isMine = (r) => isMyReport(r, auth, getDeviceId())
  const myReports = useMemo(
    () => (auth.role === 'admin' ? wasteReports : wasteReports.filter(isMine)),
    [wasteReports, auth.role, auth.email, auth.userId, auth.isAnonymous],
  )

  // Решените пријави се ЈАВНИ ПОСТОВИ — секој граѓанин ги гледа сите (од кого
  // било), како доказ дека пријавите се решаваат.
  const resolvedPosts = wasteReports.filter((r) => r.status === 'resolved')
  const activeReports = auth.role === 'admin'
    ? wasteReports.filter((r) => r.status !== 'resolved')
    : myReports.filter((r) => r.status !== 'resolved')

  const stats = useMemo(() => ({
    pending: myReports.filter((r) => r.status === 'pending').length,
    inProgress: myReports.filter((r) => r.status === 'in_progress').length,
    resolved: myReports.filter((r) => r.status === 'resolved').length,
  }), [myReports])

  function updateStatus(id, status) {
    // Пријавите од базата (UUID) се ажурираат и на backend (единствен извор).
    if (typeof id === 'string' && id.includes('-')) {
      updateReportStatus(id, status).catch(() => {})
    }
    setWasteReports((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        // +2 поени при решен проблем (вкупно 3 со пријавата) — само за
        // регистрирани корисници (анонимните немаат поени).
        if (status === 'resolved' && r.status !== 'resolved' && !r.resolvedRewardGiven) {
          if (r.reportedById && r.reportedById.includes('@')) awardPoints(r.reportedById, 2)
        }
        return {
          ...r,
          status,
          visibility: status === 'resolved' ? 'public' : r.visibility,
          resolvedAt: status === 'resolved' ? new Date().toISOString() : r.resolvedAt,
          resolvedRewardGiven: status === 'resolved' ? true : r.resolvedRewardGiven,
        }
      }),
    )
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='font-display text-2xl'>{t('waste.title')}</CardTitle>
          <CardDescription>{t('waste.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='warning'>{t('waste.pending')}: {stats.pending}</Badge>
            <Badge variant='secondary'>{t('waste.inProgress')}: {stats.inProgress}</Badge>
            <Badge>{t('waste.resolved')}: {stats.resolved}</Badge>
          </div>
        </CardContent>
      </Card>

      <section className='space-y-3'>
        <div className='flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-slate-900'>{auth.role === 'admin' ? t('waste.activeAdmin') : t('waste.activeMine')}</h2>
          <p className='text-xs text-slate-500'>{activeReports.length} {t('common.records')}</p>
        </div>
        {activeReports.length === 0 ? (
          <EmptyState
            title={auth.role === 'admin' ? t('waste.noActiveAdmin') : t('waste.noActiveMine')}
            description={auth.role === 'admin' ? t('waste.noActiveAdminDesc') : t('waste.noActiveMineDesc')}
          />
        ) : (
          <div className='grid gap-4 md:grid-cols-2'>
            {activeReports.map((report) => (
              <article key={report.id} className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md'>
                {report.photo ? (
                  <img src={report.photo} alt={report.location} className='h-48 w-full object-cover' />
                ) : (
                  <div className='flex h-28 items-center justify-center bg-slate-100 text-slate-300'>
                    <Camera className='h-7 w-7' />
                  </div>
                )}
                <div className='space-y-1.5 p-4'>
                  <div className='flex items-start justify-between gap-2'>
                    <p className='flex items-center gap-1.5 font-semibold text-slate-900'>
                      <MapPin className='h-4 w-4 shrink-0 text-sky-600' />{report.location}
                    </p>
                    <StatusBadge status={report.status} />
                  </div>
                  {report.lat != null && (
                    <p className='text-xs text-slate-400'>GPS: {Number(report.lat).toFixed(5)}, {Number(report.lng).toFixed(5)}</p>
                  )}
                  <p className='text-sm text-slate-600'>{report.description}</p>
                  <p className='flex items-center gap-1 text-xs text-slate-500'>
                    <UserRound className='h-3.5 w-3.5' />{report.reportedBy || t('common.anonymousCitizen')} · {mkDate(report.createdAt, t('waste.noDate'))}
                  </p>
                  {auth.role === 'admin' && (
                    <div className='flex flex-wrap gap-2 pt-1'>
                      <Button size='sm' variant='info' onClick={() => updateStatus(report.id, 'in_progress')}>{t('waste.markInProgress')}</Button>
                      <Button size='sm' onClick={() => updateStatus(report.id, 'resolved')}>{t('waste.markResolved')}</Button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ResolvedReportsPager
        title={t('waste.resolvedTitle')}
        items={resolvedPosts}
        countLabel={t('waste.posts')}
        emptyTitle={t('waste.noResolved')}
        emptyDescription={t('waste.noResolvedDesc')}
        t={t}
        renderItem={(report) => (
          <article key={report.id} className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md'>
            <div className='relative h-52 bg-slate-100'>
              {report.photo ? (
                <img src={report.photo} alt={report.location} className='h-full w-full object-cover' />
              ) : (
                <div className='flex h-full items-center justify-center text-slate-400'><Camera className='h-10 w-10' /></div>
              )}
              <div className='absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white'>{t('waste.resolvedTag')}</div>
            </div>
            <div className='space-y-2 p-4'>
              <p className='flex items-center gap-1.5 font-semibold text-slate-900'>
                <MapPin className='h-4 w-4 text-emerald-600' />{report.location}
              </p>
              {report.lat != null && (
                <p className='text-xs text-slate-400'>GPS: {Number(report.lat).toFixed(5)}, {Number(report.lng).toFixed(5)}</p>
              )}
              <p className='text-sm text-slate-600'>{report.description}</p>
              <div className='flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between'>
                <p className='inline-flex items-center gap-1'><UserRound className='h-3.5 w-3.5' />{t('waste.reportedBy')} {report.reportedBy || t('common.anonymousCitizen')}</p>
                <p>{mkDate(report.resolvedAt || report.createdAt, t('waste.noDate'))}</p>
              </div>
            </div>
          </article>
        )}
      />

      <Card className='border-amber-100 bg-gradient-to-br from-white to-amber-50/40'>
        <CardHeader>
          <CardTitle className='text-lg'>{t('waste.reportCardTitle')}</CardTitle>
          <CardDescription>{t('waste.reportCardSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportShortcutButton reportType='deponija' className='w-full' />
        </CardContent>
      </Card>
    </div>
  )
}
