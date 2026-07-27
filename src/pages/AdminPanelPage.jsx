import { AlertTriangle, ArrowUpDown, Biohazard, Camera, ChevronRight, Copy, Flame, MapPin, Recycle, Siren, Trash2, Wind, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Navigate } from 'react-router-dom'
import { PaginationControls } from '../components/PaginationControls'
import { StatusUpdateSuccessModal } from '../components/StatusUpdateSuccessModal'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { usePagination } from '../hooks/usePagination'
import { useApp } from '../context/AppContext'
import { copyReportToClipboard } from '../lib/reportClipboard'
import { buildSmellClusterCounts, fetchAllAirSensors, resolveSmellSensor, smellUrgencyWithCluster } from '../lib/smellSensor'
function mkDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('mk-MK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const TYPE_META = {
  waste:     { key: 'type.waste',     color: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-500',   Icon: Biohazard },
  smell:     { key: 'type.smell',     color: 'bg-rose-100 text-rose-700 border-rose-200',       dot: 'bg-rose-500',    Icon: Wind },
  container: { key: 'type.container', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', Icon: Recycle },
}

const STATUS_META = {
  pending:     { key: 'status.pending',     color: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_progress: { key: 'status.in_progress', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  resolved:    { key: 'status.resolved',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  open:        { key: 'status.pending',     color: 'bg-slate-100 text-slate-600 border-slate-200' },
}

function StatusPill({ status }) {
  const { t } = useApp()
  const m = STATUS_META[status] || STATUS_META.pending
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${m.color}`}>{t(m.key)}</span>
}

function TypePill({ type }) {
  const { t } = useApp()
  const m = TYPE_META[type] || TYPE_META.waste
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${m.color}`}><m.Icon className='h-3 w-3' />{t(m.key)}</span>
}

const containerKindLabelKey = (id) => `containerKind.${id || 'mesan'}`
const ADMIN_PAGE_SIZE = 8

function isServerReportId(id) {
  return typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)
}

function containerStatus(c) {
  if (c.status) return c.status
  return c.issueOpen ? 'pending' : 'resolved'
}

function urgencyScore(r, clusterCounts, sensors) {
  if (r.type === 'smell') {
    const { sensorId } = sensors?.length ? resolveSmellSensor(r, sensors) : { sensorId: r.nearestSensorId || '_unknown' }
    const count = clusterCounts?.get(sensorId) || 1
    return smellUrgencyWithCluster(r, count)
  }
  if (r.type === 'waste') return r.status === 'pending' ? 15 : r.status === 'in_progress' ? 8 : 0
  if (r.type === 'container') return r.status === 'in_progress' ? 8 : r.issueOpen ? 10 : 0
  return 0
}

function ReportDrawer({ report, onClose, onUpdateStatus, onDelete, clusterCount, sensorName, onCopyFeedback }) {
  const { t } = useApp()
  const [pendingStatus, setPendingStatus] = useState(report.status)
  const [copying, setCopying] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const changed = report.type !== 'smell' && pendingStatus !== report.status

  useEffect(() => {
    setPendingStatus(report.status)
  }, [report.id, report.status])

  function requestClose() {
    if (changed && !window.confirm(t('admin.unsavedStatusConfirm'))) return
    onClose()
  }

  async function handleDelete() {
    if (!window.confirm(t('admin.deleteReportConfirm'))) return
    setDeleting(true)
    try {
      const ok = await onDelete(report)
      if (ok === false) onCopyFeedback(t('admin.deleteReportFailed'))
      else onCopyFeedback(t('admin.deleteReportSuccess'))
    } catch {
      onCopyFeedback(t('admin.deleteReportFailed'))
    } finally {
      setDeleting(false)
    }
  }

  const statusFlow = [
    { key: 'pending',     label: t('status.pending') },
    { key: 'in_progress', label: t('status.in_progress') },
    { key: 'resolved',    label: t('status.resolved') },
  ]

  // Portal во <body>: родителските анимации на страниците користат transform,
  // што „заробува" fixed елементи во рамки на контејнерот. Со portal фиоката
  // го покрива целиот екран и се лизга од десно кон лево (како sidebar менито).
  return createPortal(
    <div className='fixed inset-0 z-[1200] flex'>
      <div className='animate-drawer-overlay-in absolute inset-0 bg-slate-900/40' onClick={requestClose} />
      <aside className='animate-drawer-in-right relative ml-auto flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl'>
        {/* Header */}
        <div className='app-safe-drawer-head flex items-center justify-between border-b border-slate-200 px-5 pb-4'>
          <div className='flex items-center gap-2'>
            <TypePill type={report.type} />
            <StatusPill status={report.status} />
          </div>
          <div className='flex items-center gap-1'>
            <Button
              size='sm'
              variant='outline'
              disabled={copying || deleting}
              onClick={async () => {
                setCopying(true)
                try {
                  await copyReportToClipboard(report, t, { clusterCount, sensorName })
                  onCopyFeedback(t('admin.copyReportSuccess'))
                } catch {
                  onCopyFeedback(t('admin.copyReportFailed'))
                } finally {
                  setCopying(false)
                }
              }}
            >
              <Copy className='h-3.5 w-3.5' />{t('admin.copyReport')}
            </Button>
            <button
              type='button'
              onClick={requestClose}
              className='rounded-lg p-1.5 text-slate-400 hover:bg-slate-100'
              aria-label={t('common.close')}
            >
              <X className='h-5 w-5' />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto app-scroll p-5 space-y-5'>
          {/* Photos */}
          {(report.photos?.length ? report.photos : report.photo ? [report.photo] : []).length > 0 ? (
            <div className='grid grid-cols-2 gap-2'>
              {(report.photos?.length ? report.photos : [report.photo]).map((src, idx) => (
                <img key={idx} src={src} alt={t('photo.altPhotoFull', { n: idx + 1 })} className='w-full rounded-xl border border-slate-200 object-cover' style={{ maxHeight: 200 }} />
              ))}
            </div>
          ) : (
            <div className='flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-300'>
              <Camera className='h-8 w-8' />
            </div>
          )}

          {/* Location */}
          <div className='rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1'>
            <p className='flex items-center gap-2 font-semibold text-slate-900'>
              <MapPin className='h-4 w-4 text-slate-400' />
              {report.location || report.area || '—'}
            </p>
            <p className='pl-6 text-xs text-slate-500'>
              {t('admin.municipality')}: <span className='font-medium text-slate-700'>{report.municipality || t('admin.municipalityUnknown')}</span>
            </p>
            {report.lat != null && (
              <>
                <p className='text-xs text-slate-400 pl-6'>GPS: {Number(report.lat).toFixed(5)}, {Number(report.lng).toFixed(5)}</p>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${Number(report.lat)}&mlon=${Number(report.lng)}#map=18/${Number(report.lat)}/${Number(report.lng)}`}
                  target='_blank'
                  rel='noreferrer'
                  className='ml-6 mt-1 inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700'
                >
                  <MapPin className='h-3 w-3' />{t('admin.openMap')}
                </a>
              </>
            )}
          </div>

          {/* Details */}
          <div className='space-y-3'>
            {report.description && (
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{t('admin.desc')}</p>
                <p className='mt-1 text-sm text-slate-700'>{report.description}</p>
              </div>
            )}
            {report.message && (
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{t('admin.message')}</p>
                <p className='mt-1 text-sm text-slate-700'>{report.message}</p>
              </div>
            )}
            {report.intensity != null && (
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{t('admin.smellIntensity')}</p>
                <div className='mt-1 flex items-center gap-1'>
                  {[1,2,3,4,5].map((n) => (
                    <Flame key={n} className='h-5 w-5' style={{ fill: report.intensity >= n ? '#fb923c' : 'none', color: report.intensity >= n ? '#ea580c' : '#cbd5e1' }} />
                  ))}
                  <span className='ml-1 text-sm font-semibold text-slate-700'>{report.intensity}/5</span>
                </div>
              </div>
            )}
            {report.type === 'smell' && clusterCount > 1 && (
              <div className='rounded-xl border border-rose-200 bg-rose-50 p-3'>
                <p className='text-sm font-semibold text-rose-800'>
                  {t('admin.smellClusterDetail', { count: clusterCount, sensor: sensorName || t('admin.unknownLocation') })}
                </p>
              </div>
            )}
            {report.type === 'container' && (
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{t('admin.containerType')}</p>
                <p className='mt-1 text-sm text-slate-700'>{t(containerKindLabelKey(report.kind))}</p>
              </div>
            )}
            {report.issue && (
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{t('admin.problemType')}</p>
                <p className='mt-1 text-sm text-slate-700'>{report.issue === 'full' ? t('container.full') : report.issue === 'smell' ? t('container.smell') : report.issue === 'broken' ? t('container.broken') : report.issue}</p>
              </div>
            )}
            {report.fill != null && (
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{t('admin.fill')}</p>
                <div className='mt-1 flex items-center gap-2'>
                  <div className='flex-1 h-2 rounded-full bg-slate-200 overflow-hidden'>
                    <div className='h-full rounded-full bg-emerald-500' style={{ width: `${report.fill}%` }} />
                  </div>
                  <span className='text-sm font-semibold text-slate-700'>{report.fill}%</span>
                </div>
              </div>
            )}
            <div className='grid grid-cols-2 gap-3 text-sm'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{t('admin.reportedBy')}</p>
                <p className='mt-0.5 text-slate-700'>{report.reportedBy || report.createdBy || t('common.anonymous')}</p>
              </div>
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{t('admin.date')}</p>
                <p className='mt-0.5 text-slate-700'>{mkDate(report.createdAt)}</p>
              </div>
              {report.resolvedAt && (
                <div className='col-span-2'>
                  <p className='text-xs font-semibold uppercase tracking-wide text-slate-400'>{t('admin.resolvedOn')}</p>
                  <p className='mt-0.5 text-slate-700'>{mkDate(report.resolvedAt)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status flow — only for waste/container */}
          {report.type !== 'smell' && (
            <div>
              <p className='mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400'>{t('admin.updateStatus')}</p>
              <div className='flex flex-col gap-2'>
                {statusFlow.map((s) => {
                  const isCurrent = pendingStatus === s.key
                  return (
                    <button
                      key={s.key}
                      type='button'
                      onClick={() => setPendingStatus(s.key)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-150 ${
                        isCurrent
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>{s.label}</span>
                      {isCurrent && <span className='text-xs font-normal text-emerald-600'>● {t('admin.selected')}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Delete invalid report */}
          <div className='rounded-xl border border-rose-100 bg-rose-50/60 p-3'>
            <Button
              type='button'
              variant='outline'
              disabled={deleting || copying}
              className='w-full justify-center gap-2 border-rose-200 text-rose-700 hover:bg-rose-100'
              onClick={handleDelete}
            >
              <Trash2 className='h-4 w-4' />
              {deleting ? '…' : t('admin.deleteReport')}
            </Button>
          </div>
        </div>

        {/* Footer save */}
        {report.type !== 'smell' && (
          <div className='app-safe-drawer-foot border-t border-slate-200 px-5 pt-4 flex gap-3'>
            <Button
              className='flex-1'
              disabled={!changed || deleting}
              onClick={async () => {
                const ok = await onUpdateStatus(report, pendingStatus)
                if (ok !== false) onClose()
              }}
            >
              {t('admin.saveStatus')}
            </Button>
            <Button variant='outline' onClick={requestClose}>{t('common.cancel')}</Button>
          </div>
        )}
        {report.type === 'smell' && (
          <div className='app-safe-drawer-foot border-t border-slate-200 px-5 pt-4'>
            <Button variant='outline' className='w-full' onClick={requestClose}>{t('common.close')}</Button>
          </div>
        )}
      </aside>
    </div>,
    document.body
  )
}

export function AdminPanelPage() {
  const { auth, wasteReports, setWasteReports, smellAlerts, containers, setContainers, pushNotification, changeReportStatus, deleteReport, removeReportLocally, refreshData, t } = useApp()
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [selected, setSelected] = useState(null)
  const [airSensors, setAirSensors] = useState([])
  const [statusSuccess, setStatusSuccess] = useState(null)
  const [copyToast, setCopyToast] = useState('')

  useEffect(() => {
    refreshData()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchAllAirSensors(controller.signal).then(setAirSensors).catch(() => {})
    return () => controller.abort()
  }, [smellAlerts.length])

  const smellClusterCounts = useMemo(
    () => buildSmellClusterCounts(smellAlerts, airSensors),
    [smellAlerts, airSensors],
  )

  if (auth.role !== 'admin') return <Navigate to='/home' replace />

  // Merge all reports into unified list
  const allReports = useMemo(() => {
    const waste = wasteReports.map((r) => ({ ...r, type: 'waste', status: r.status || 'pending' }))
    const smell = smellAlerts.map((r) => ({ ...r, type: 'smell', status: 'pending', location: r.location || '—' }))
    const cont = containers.map((c) => ({
      ...c,
      type: 'container',
      status: containerStatus(c),
      location: c.area,
      createdAt: c.createdAt || '',
    }))
    return [...waste, ...smell, ...cont]
  }, [wasteReports, smellAlerts, containers])

  const liveSelected = useMemo(() => {
    if (!selected) return null
    return allReports.find((r) => r.id === selected.id && r.type === selected.type) || selected
  }, [selected, allReports])

  const filtered = useMemo(() => {
    let list = allReports
    if (typeFilter !== 'all') list = list.filter((r) => r.type === typeFilter)
    if (statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter)
    return [...list].sort((a, b) => {
      let va, vb
      if (sortBy === 'date') { va = new Date(a.createdAt || 0).getTime(); vb = new Date(b.createdAt || 0).getTime() }
      else if (sortBy === 'urgency') { va = urgencyScore(a, smellClusterCounts, airSensors); vb = urgencyScore(b, smellClusterCounts, airSensors) }
      else if (sortBy === 'type') { va = a.type; vb = b.type; return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va) }
      else { va = 0; vb = 0 }
      return sortDir === 'asc' ? va - vb : vb - va
    })
  }, [allReports, typeFilter, statusFilter, sortBy, sortDir, smellClusterCounts, airSensors])

  const paginationKey = `${typeFilter}-${statusFilter}-${sortBy}-${sortDir}`
  const {
    visible: pagedReports,
    currentPage,
    totalPages,
    total: filteredTotal,
    setPage,
    from,
    to,
  } = usePagination(filtered, ADMIN_PAGE_SIZE, paginationKey)

  function toggleSort(col) {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('desc') }
  }

  async function updateStatus(report, newStatus) {
    const statusLabel = STATUS_META[newStatus] ? t(STATUS_META[newStatus].key) : newStatus
    const location = report.location || report.area || t('admin.unknownLocation')

    if (isServerReportId(report.id)) {
      const result = await changeReportStatus(report.id, newStatus)
      if (!result.ok) {
        pushNotification({
          title: t('admin.statusUpdateFailedTitle'),
          body: t('admin.statusUpdateFailedBody', { loc: location }),
        })
        return false
      }
    } else if (report.type === 'waste') {
      setWasteReports((prev) => prev.map((r) => {
        if (r.id !== report.id) return r
        return {
          ...r,
          status: newStatus,
          visibility: newStatus === 'resolved' ? 'public' : r.visibility,
          resolvedAt: newStatus === 'resolved' ? new Date().toISOString() : r.resolvedAt,
        }
      }))
    } else if (report.type === 'container') {
      setContainers((prev) => prev.map((c) => {
        if (c.id !== report.id) return c
        return {
          ...c,
          status: newStatus,
          issueOpen: newStatus !== 'resolved',
          issue: newStatus === 'resolved' ? 'none' : c.issue,
        }
      }))
    }

    setStatusFilter(newStatus)
    setStatusSuccess({
      title: t('admin.statusUpdatedTitle', { status: statusLabel }),
      body: t('admin.statusUpdatedBody', { loc: location, status: statusLabel }),
    })

    return true
  }

  async function handleDeleteReport(report) {
    if (isServerReportId(report.id)) {
      const result = await deleteReport(report.id, report.type)
      if (!result.ok) return false
    } else {
      removeReportLocally(report.id, report.type)
    }
    setSelected(null)
    return true
  }

  const activeReports = useMemo(
    () => allReports.filter((r) => r.status !== 'resolved'),
    [allReports],
  )

  const counts = useMemo(() => ({
    all: activeReports.length,
    waste: activeReports.filter((r) => r.type === 'waste').length,
    smell: activeReports.filter((r) => r.type === 'smell').length,
    container: activeReports.filter((r) => r.type === 'container').length,
    pending: activeReports.filter((r) => r.status === 'pending').length,
    in_progress: activeReports.filter((r) => r.status === 'in_progress').length,
    resolved: allReports.filter((r) => r.status === 'resolved').length,
  }), [allReports, activeReports])

  return (
    <div className='space-y-4'>
      <div>
        <h1 className='font-display text-2xl font-bold text-slate-900'>{t('admin.panelTitle')}</h1>
        <p className='text-sm text-slate-500'>{t('admin.summary', { total: counts.all, pending: counts.pending })}</p>
      </div>

      {/* Statistics row */}
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {[
          { label: t('admin.statActiveDumps'), value: counts.waste, icon: Trash2, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: t('admin.statFullContainers'), value: counts.container, icon: Recycle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: t('admin.statResolved'), value: counts.resolved, icon: Siren, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
          { label: t('admin.statUnresolved'), value: counts.pending + counts.in_progress, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border ${s.border} ${s.bg} p-4`}>
            <div className='flex items-center justify-between'>
              <p className='text-xs font-medium text-slate-500'>{s.label}</p>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </div>
            <p className={`mt-2 text-3xl font-bold ${s.color}`}>{Math.max(0, s.value)}</p>
          </div>
        ))}
      </div>

      {/* Summary pills */}
      <div className='flex flex-wrap gap-2'>
        {[
          { key: 'all', label: t('filter.all'), count: counts.all },
          { key: 'waste', label: t('desk.tabsWaste'), count: counts.waste },
          { key: 'smell', label: t('type.smell'), count: counts.smell },
          { key: 'container', label: t('nav.containers'), count: counts.container },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${typeFilter === f.key ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${typeFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{f.count}</span>
          </button>
        ))}
        <div className='ml-auto flex gap-2'>
          {[
            { key: 'pending', label: t('admin.filterPending') },
            { key: 'in_progress', label: t('admin.filterInProgress') },
            { key: 'resolved', label: t('admin.filterResolved') },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${statusFilter === s.key ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className='flex justify-end'>
        <PaginationControls
          total={filteredTotal}
          countLabel={t('admin.reportsCount')}
          currentPage={currentPage}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          t={t}
        />
      </div>

      {/* Table */}
      <div className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-slate-200 bg-slate-50'>
                <th className='px-4 py-3 text-left'>
                  <button onClick={() => toggleSort('type')} className='flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800'>
                    {t('table.type')} <ArrowUpDown className='h-3 w-3' />
                  </button>
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500'>{t('table.location')}</th>
                <th className='hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 md:table-cell'>{t('table.reportedBy')}</th>
                <th className='px-4 py-3 text-left'>
                  <button onClick={() => toggleSort('urgency')} className='flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800'>
                    {t('table.urgency')} <ArrowUpDown className='h-3 w-3' />
                  </button>
                </th>
                <th className='px-4 py-3 text-left'>
                  <button onClick={() => toggleSort('date')} className='flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800'>
                    {t('table.date')} <ArrowUpDown className='h-3 w-3' />
                  </button>
                </th>
                <th className='px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500'>{t('table.status')}</th>
                <th className='px-4 py-3' />
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              {filteredTotal === 0 && (
                <tr><td colSpan={7} className='px-4 py-10 text-center text-sm text-slate-400'>{t('admin.noReports')}</td></tr>
              )}
              {pagedReports.map((r) => {
                const { sensorId, sensorName } = r.type === 'smell' && airSensors.length
                  ? resolveSmellSensor(r, airSensors)
                  : { sensorId: r.nearestSensorId || '_unknown', sensorName: null }
                const clusterCount = r.type === 'smell' ? (smellClusterCounts.get(sensorId) || 1) : 1
                const urgency = urgencyScore(r, smellClusterCounts, airSensors)
                return (
                  <tr
                    key={`${r.type}-${r.id}`}
                    onClick={() => setSelected(r)}
                    className='cursor-pointer transition-colors duration-100 hover:bg-slate-50'
                  >
                    <td className='px-4 py-3'><TypePill type={r.type} /></td>
                    <td className='px-4 py-3'>
                      <p className='font-medium text-slate-900 truncate max-w-[160px]'>{r.location || r.area || '—'}</p>
                      {r.type === 'smell' && sensorName && (
                        <p className='mt-0.5 truncate text-[11px] text-slate-500'>{t('admin.smellSensor')}: {sensorName}</p>
                      )}
                      {r.type === 'smell' && clusterCount > 1 && (
                        <p className='mt-0.5 text-[11px] font-semibold text-rose-600'>{t('admin.smellClusterCount', { count: clusterCount })}</p>
                      )}
                      {r.intensity != null && (
                        <div className='mt-0.5 flex gap-0.5'>
                          {[1,2,3,4,5].map((n) => <Flame key={n} className='h-3 w-3' style={{ fill: r.intensity >= n ? '#fb923c' : 'none', color: r.intensity >= n ? '#ea580c' : '#e2e8f0' }} />)}
                        </div>
                      )}
                    </td>
                    <td className='hidden px-4 py-3 text-slate-500 md:table-cell'>{r.reportedBy || r.createdBy || t('common.anonymous')}</td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-1.5'>
                        <div className={`h-2 w-2 rounded-full ${urgency >= 20 ? 'bg-rose-500' : urgency >= 10 ? 'bg-amber-400' : 'bg-slate-300'}`} />
                        <span className='text-xs text-slate-500'>{urgency >= 20 ? t('urgency.high') : urgency >= 10 ? t('urgency.medium') : t('urgency.low')}</span>
                      </div>
                    </td>
                    <td className='px-4 py-3 text-xs text-slate-400 whitespace-nowrap'>{mkDate(r.createdAt)}</td>
                    <td className='px-4 py-3'><StatusPill status={r.status} /></td>
                    <td className='px-4 py-3'><ChevronRight className='h-4 w-4 text-slate-300' /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className='border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400'>
          {filteredTotal === 0
            ? t('admin.noReports')
            : t('admin.showingRange', { from, to, total: filteredTotal })}
        </div>
      </div>

      {liveSelected && (
        <ReportDrawer
          report={liveSelected}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateStatus}
          onDelete={handleDeleteReport}
          onCopyFeedback={setCopyToast}
          clusterCount={
            liveSelected.type === 'smell'
              ? (smellClusterCounts.get(
                  resolveSmellSensor(liveSelected, airSensors).sensorId,
                ) || 1)
              : 1
          }
          sensorName={
            liveSelected.type === 'smell'
              ? resolveSmellSensor(liveSelected, airSensors).sensorName
              : null
          }
        />
      )}

      <StatusUpdateSuccessModal
        open={!!statusSuccess}
        title={statusSuccess?.title}
        body={statusSuccess?.body}
        onClose={() => setStatusSuccess(null)}
      />
      <Toast toast={copyToast} onClose={() => setCopyToast('')} />
    </div>
  )
}
