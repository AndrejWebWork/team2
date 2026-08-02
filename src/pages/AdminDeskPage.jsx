import { AlertTriangle, Camera, CheckCircle2, Flame, MapPin, Recycle, Siren, Trash2, Wind } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { StatusUpdateSuccessModal } from '../components/StatusUpdateSuccessModal'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'
import { updateReportStatus, serverToContainer, serverToWaste } from '../lib/api'
import { canAccessReportType, isAdminRole } from '../lib/roles'
import { fetchAllAirSensors, groupSmellsBySensor } from '../lib/smellSensor'
function mkDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('mk-MK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function osmUrl(lat, lng) {
  return `https://www.openstreetmap.org/?mlat=${Number(lat)}&mlon=${Number(lng)}#map=18/${Number(lat)}/${Number(lng)}`
}

// Општина + линк до точна локација на мапа (за надлежната служба).
function LocationMeta({ lat, lng, municipality }) {
  const { t } = useApp()
  return (
    <p className='text-xs text-slate-400'>
      {t('admin.municipality')}: <span className='text-slate-500'>{municipality || t('admin.municipalityUnknown')}</span>
      {lat != null && (
        <>
          {' · '}
          <a href={osmUrl(lat, lng)} target='_blank' rel='noreferrer' className='font-semibold text-sky-600 hover:text-sky-700'>
            {t('admin.openMap')}
          </a>
        </>
      )}
    </p>
  )
}

const containerKindLabelKey = (id) => `containerKind.${id || 'mesan'}`

const TABS = [
  { key: 'waste', labelKey: 'desk.tabsWaste' },
  { key: 'smell', labelKey: 'desk.tabsSmell' },
  { key: 'containers', labelKey: 'desk.tabsContainers' },
]

const STATUS_META = {
  pending: 'status.pending',
  in_progress: 'status.in_progress',
  resolved: 'status.resolved',
}

function SectionEmpty({ text }) {
  return <p className='py-8 text-center text-sm text-slate-400'>{text}</p>
}

function WasteRow({ report, onStatus }) {
  const { t } = useApp()
  return (
    <div className='flex items-start gap-4 border-b border-slate-100 py-4 last:border-0'>
      {report.photo
        ? <img src={report.photo} alt='' className='h-14 w-14 shrink-0 rounded-xl object-cover' />
        : <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100'><Camera className='h-5 w-5 text-slate-300' /></div>
      }
      <div className='min-w-0 flex-1 space-y-0.5'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='flex items-center gap-1 font-semibold text-slate-900 text-sm'>
            <MapPin className='h-3.5 w-3.5 text-amber-500' />{report.location}
          </span>
          <Badge variant={report.status === 'pending' ? 'warning' : report.status === 'in_progress' ? 'secondary' : 'default'}>
            {report.status === 'pending' ? t('badge.pending') : report.status === 'in_progress' ? t('badge.inProgress') : t('badge.resolved')}
          </Badge>
        </div>
        <p className='text-sm text-slate-600 line-clamp-2'>{report.description}</p>
        <p className='text-xs text-slate-400'>{report.reportedBy || t('common.anonymous')} · {mkDate(report.createdAt)}</p>
        <LocationMeta lat={report.lat} lng={report.lng} municipality={report.municipality} />
        {report.status !== 'resolved' && (
          <div className='flex gap-2 pt-1'>
            <Button size='sm' variant='outline' onClick={() => onStatus(report.id, 'in_progress')}>{t('desk.inProgressBtn')}</Button>
            <Button size='sm' onClick={() => onStatus(report.id, 'resolved')}><CheckCircle2 className='h-3.5 w-3.5' />{t('desk.resolvedBtn')}</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function SmellRow({ alert, nested = false }) {
  const { t } = useApp()
  return (
    <div className={`flex items-start gap-4 border-b border-slate-100 py-4 last:border-0 ${nested ? 'pl-2 border-l-2 border-l-rose-100' : ''}`}>
      <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50'>
        <Flame className='h-5 w-5 text-rose-500' />
      </div>
      <div className='min-w-0 flex-1 space-y-0.5'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='flex items-center gap-1 font-semibold text-slate-900 text-sm'>
            <MapPin className='h-3.5 w-3.5 text-rose-400' />{alert.location}
          </span>
          <Badge variant={alert.severity === 'critical' ? 'destructive' : 'warning'}>
            {alert.severity === 'critical' ? t('badge.critical') : t('badge.warning')}
          </Badge>
          {alert.intensity != null && (
            <span className='flex items-center gap-0.5'>
              {[1,2,3,4,5].map((n) => (
                <Flame key={n} className='h-3 w-3' style={{ fill: alert.intensity >= n ? '#fb923c' : 'none', color: alert.intensity >= n ? '#ea580c' : '#cbd5e1' }} />
              ))}
            </span>
          )}
        </div>
        <p className='text-sm text-slate-600'>{alert.message}</p>
        <p className='text-xs text-slate-400'>{alert.createdBy || t('common.anonymous')} · {mkDate(alert.createdAt)}</p>
        <LocationMeta lat={alert.lat} lng={alert.lng} municipality={alert.municipality} />
      </div>
    </div>
  )
}

function SmellClusterBlock({ group }) {
  const { t } = useApp()
  const title = group.sensorName
    ? t('desk.smellClusterTitle', { sensor: group.sensorName, count: group.count })
    : `${t('desk.smellNearSensor')} · ${group.count}`

  return (
    <div className='border-b border-slate-200 last:border-0'>
      <div className='flex flex-wrap items-center gap-2 bg-slate-50 px-1 py-3'>
        <Wind className='h-4 w-4 shrink-0 text-rose-500' />
        <p className='text-sm font-bold text-slate-900'>{title}</p>
        {group.hasCritical && <Badge variant='destructive'>{t('badge.critical')}</Badge>}
        {group.count > 1 && (
          <Badge variant='warning'>{t('admin.smellClusterCount', { count: group.count })}</Badge>
        )}
      </div>
      {group.alerts.map((a) => (
        <SmellRow key={a.id} alert={a} nested />
      ))}
    </div>
  )
}

function ContainerRow({ container, onReset }) {
  const { t } = useApp()
  return (
    <div className='flex items-start gap-4 border-b border-slate-100 py-4 last:border-0'>
      <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50'>
        <Recycle className='h-5 w-5 text-emerald-500' />
      </div>
      <div className='min-w-0 flex-1 space-y-0.5'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='flex items-center gap-1 font-semibold text-slate-900 text-sm'>
            <MapPin className='h-3.5 w-3.5 text-emerald-500' />{container.area}
          </span>
          <Badge variant={container.issueOpen ? 'warning' : 'default'}>
            {container.issueOpen ? t('badge.open') : t('badge.resolved')}
          </Badge>
        </div>
        <p className='text-sm text-slate-600'>
          {container.issue === 'full' ? t('desk.full') : container.issue === 'smell' ? t('desk.smell') : container.issue === 'broken' ? t('desk.broken') : container.issue}
          {container.fill != null && <>{' · '}{container.fill}% {t('desk.filledWord')}</>}
        </p>
        <span className='inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600'>
          {t(containerKindLabelKey(container.kind))}
        </span>
        {container.description && <p className='text-sm text-slate-500'>{container.description}</p>}
        <p className='text-xs text-slate-400'>{container.reportedBy || t('common.anonymous')} · {mkDate(container.createdAt)}</p>
        <LocationMeta lat={container.lat} lng={container.lng} municipality={container.municipality} />
        {container.issueOpen && (
          <div className='pt-1'>
            <Button size='sm' onClick={() => onReset(container.id)}><CheckCircle2 className='h-3.5 w-3.5' />{t('desk.markResolved')}</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function defaultDeskTab(role) {
  if (canAccessReportType(role, 'waste')) return 'waste'
  if (canAccessReportType(role, 'smell')) return 'smell'
  if (canAccessReportType(role, 'container')) return 'containers'
  return 'waste'
}

export function AdminDeskPage() {
  const { auth, smellAlerts, wasteReports, containers, setWasteReports, setContainers, pushNotification, t } = useApp()
  const [tab, setTab] = useState(() => defaultDeskTab(auth.role))
  const [airSensors, setAirSensors] = useState([])
  const [statusSuccess, setStatusSuccess] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchAllAirSensors(controller.signal).then(setAirSensors).catch(() => {})
    return () => controller.abort()
  }, [smellAlerts.length])

  const canSmell = canAccessReportType(auth.role, 'smell')
  const canWaste = canAccessReportType(auth.role, 'waste')
  const canContainer = canAccessReportType(auth.role, 'container')
  const visibleSmellAlerts = canSmell ? smellAlerts : []

  const smellGroups = useMemo(
    () => groupSmellsBySensor(visibleSmellAlerts, airSensors),
    [visibleSmellAlerts, airSensors],
  )

  if (!isAdminRole(auth.role)) return <Navigate to='/air' replace />

  const visibleTabs = TABS.filter((tabItem) => {
    const type = tabItem.key === 'containers' ? 'container' : tabItem.key
    return canAccessReportType(auth.role, type)
  })
  const defaultTab = visibleTabs[0]?.key || defaultDeskTab(auth.role)
  const activeTab = visibleTabs.some((x) => x.key === tab) ? tab : defaultTab

  const unresolvedWaste = canWaste
    ? wasteReports.filter((r) => r.status !== 'resolved')
    : []
  const openContainers = canContainer
    ? containers.filter((c) => c.issueOpen)
    : []

  // Промената прво се потврдува на backend; при одбивање (пр. невалиден админ
  // токен) не се прикажува лажен успех. Поените ги доделува ИСКЛУЧИВО backend.
  async function updateWasteStatus(id, status) {
    const loc = wasteReports.find((r) => r.id === id)?.location || t('admin.unknownLocation')
    if (!(typeof id === 'string' && id.includes('-'))) {
      pushNotification({ title: t('admin.statusUpdateFailedTitle'), body: t('admin.statusUpdateFailedBody', { loc }) })
      return
    }
    let serverRow = null
    try {
      serverRow = await updateReportStatus(id, status)
    } catch {
      pushNotification({ title: t('admin.statusUpdateFailedTitle'), body: t('admin.statusUpdateFailedBody', { loc }) })
      return
    }
    const mapped = serverRow ? serverToWaste(serverRow) : null
    const statusLabel = t(STATUS_META[status] || STATUS_META.pending)
    setWasteReports((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        if (mapped) return { ...r, ...mapped }
        return {
          ...r,
          status,
          visibility: status === 'resolved' ? 'public' : r.visibility,
          resolvedAt: status === 'resolved' ? new Date().toISOString() : r.resolvedAt,
        }
      }),
    )
    setStatusSuccess({
      title: t('admin.statusUpdatedTitle', { status: statusLabel }),
      body: t('admin.statusUpdatedBody', { loc, status: statusLabel }),
    })
  }

  async function resetContainer(id) {
    const loc = containers.find((c) => c.id === id)?.area || t('admin.unknownLocation')
    if (!(typeof id === 'string' && id.includes('-'))) {
      pushNotification({ title: t('admin.statusUpdateFailedTitle'), body: t('admin.statusUpdateFailedBody', { loc }) })
      return
    }
    let serverRow = null
    try {
      serverRow = await updateReportStatus(id, 'resolved')
    } catch {
      pushNotification({ title: t('admin.statusUpdateFailedTitle'), body: t('admin.statusUpdateFailedBody', { loc }) })
      return
    }
    const mapped = serverRow ? serverToContainer(serverRow) : null
    const statusLabel = t('status.resolved')
    setContainers((prev) => prev.map((c) => {
      if (c.id !== id) return c
      if (mapped) return mapped
      return { ...c, issue: 'none', issueOpen: false }
    }))
    setStatusSuccess({
      title: t('admin.statusUpdatedTitle', { status: statusLabel }),
      body: t('admin.statusUpdatedBody', { loc, status: statusLabel }),
    })
  }

  const stats = [
    canSmell && { label: t('desk.statSmell'), value: visibleSmellAlerts.length, icon: Siren, accent: 'bg-rose-50 text-rose-600 border-rose-100' },
    canWaste && { label: t('desk.statWaste'), value: wasteReports.length, icon: Trash2, accent: 'bg-amber-50 text-amber-600 border-amber-100' },
    canContainer && { label: t('desk.statContainers'), value: openContainers.length, icon: Recycle, accent: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: t('desk.statUnresolved'), value: unresolvedWaste.length + openContainers.length + visibleSmellAlerts.length, icon: AlertTriangle, accent: 'bg-slate-50 text-slate-600 border-slate-200' },
  ].filter(Boolean)

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold text-slate-900'>{t('desk.title')}</h1>
        <p className='mt-0.5 text-sm text-slate-500'>{t('desk.subtitle')}</p>
      </div>

      {/* Stat cards */}
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        {stats.map(({ label, value, icon: Icon, accent }) => (
          <Card key={label} className={`border ${accent.split(' ')[2]}`}>
            <CardContent className='p-4'>
              <div className={`mb-3 inline-flex rounded-lg p-2 ${accent.split(' ')[0]}`}>
                <Icon className={`h-4 w-4 ${accent.split(' ')[1]}`} />
              </div>
              <p className='text-2xl font-bold text-slate-900'>{Math.max(0, value)}</p>
              <p className='mt-0.5 text-xs text-slate-500'>{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Card>
        <CardHeader className='pb-0 pt-4 px-4'>
          <div className='flex gap-1 border-b border-slate-100 pb-0'>
            {visibleTabs.map((tabItem) => {
              const count = tabItem.key === 'waste' ? unresolvedWaste.length : tabItem.key === 'smell' ? visibleSmellAlerts.length : openContainers.length
              return (
                <button
                  key={tabItem.key}
                  type='button'
                  onClick={() => setTab(tabItem.key)}
                  className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === tabItem.key
                      ? 'text-emerald-700 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-emerald-600'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t(tabItem.labelKey)}
                  {count > 0 && (
                    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === tabItem.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className='px-4 py-2'>
          {activeTab === 'waste' && (
            unresolvedWaste.length === 0
              ? <SectionEmpty text={t('desk.emptyWaste')} />
              : unresolvedWaste.map((r) => <WasteRow key={r.id} report={r} onStatus={updateWasteStatus} />)
          )}
          {activeTab === 'smell' && (
            visibleSmellAlerts.length === 0
              ? <SectionEmpty text={t('desk.emptySmell')} />
              : smellGroups.map((group) => <SmellClusterBlock key={group.sensorId} group={group} />)
          )}
          {activeTab === 'containers' && (
            openContainers.length === 0
              ? <SectionEmpty text={t('desk.emptyContainers')} />
              : openContainers.map((c) => <ContainerRow key={c.id} container={c} onReset={resetContainer} />)
          )}
        </CardContent>
      </Card>

      <StatusUpdateSuccessModal
        open={!!statusSuccess}
        title={statusSuccess?.title}
        body={statusSuccess?.body}
        onClose={() => setStatusSuccess(null)}
      />
    </div>
  )
}
