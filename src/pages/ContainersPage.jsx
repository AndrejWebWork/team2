import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CheckCircle2, MapPin, Phone, Sofa } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup } from 'react-leaflet'
import { EmptyState } from '../components/EmptyState'
import { MapLayers } from '../components/MapLayers'
import { ReportShortcutButton } from '../components/ReportShortcutButton'
import { ResolvedReportsPager } from '../components/ResolvedReportsPager'
import { StatusUpdateSuccessModal } from '../components/StatusUpdateSuccessModal'
import { StatusBadge } from '../components/StatusBadge'
import { Toast } from '../components/Toast'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useApp } from '../context/AppContext'
import { fetchContainerPoints, updateReportStatus } from '../lib/api'
import { containerKinds } from '../data/catalog'
import { skopjeAllContainerPoints } from '../data/skopjeContainersMap'
import { isNativePlatform } from '../lib/notifications'
import { canAccessReportType, isAdminRole } from '../lib/roles'

// Бесплатна линија на „Комунална хигиена" за пријава на кабаст отпад.
const BULKY_PHONE_DISPLAY = '080 022233'
const BULKY_PHONE_TEL = '080022233'

const kindColor = Object.fromEntries(containerKinds.map((k) => [k.id, k.color]))

const recyclingIcon = L.divIcon({
  className: 'map-dot',
  html: "<span style='display:block;width:40px;height:30px'><svg viewBox='0 0 24 24' width='40' height='30' xmlns='http://www.w3.org/2000/svg'><path d='M4 8h16l-1.4 11.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 8Z' fill='#22c55e' stroke='#ffffff' stroke-width='1.4'/><path d='M9 8V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V8' fill='none' stroke='#ffffff' stroke-width='1.4' stroke-linecap='round'/><path d='M3 8h18' stroke='#166534' stroke-width='1.6' stroke-linecap='round'/><path d='M10 11v6M14 11v6' stroke='#166534' stroke-width='1.4' stroke-linecap='round'/></svg></span>",
  iconSize: [40, 30],
  iconAnchor: [20, 15],
})
const basketIcon = L.divIcon({
  className: 'map-dot',
  html: "<span style='display:block;width:32px;height:24px'><svg viewBox='0 0 24 24' width='32' height='24' xmlns='http://www.w3.org/2000/svg'><path d='M5 8h14l-1 10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8Z' fill='#38bdf8' stroke='#ffffff' stroke-width='1.4'/><path d='M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8' fill='none' stroke='#ffffff' stroke-width='1.3' stroke-linecap='round'/></svg></span>",
  iconSize: [32, 24],
  iconAnchor: [16, 12],
})
// Контејнер за отпад (amenity=waste_disposal) — портокалова кофа.
const disposalIcon = L.divIcon({
  className: 'map-dot',
  html: "<span style='display:block;width:34px;height:26px'><svg viewBox='0 0 24 24' width='34' height='26' xmlns='http://www.w3.org/2000/svg'><path d='M4.5 8h15l-1.2 10.4a2 2 0 0 1-2 1.6H7.7a2 2 0 0 1-2-1.6L4.5 8Z' fill='#f59e0b' stroke='#ffffff' stroke-width='1.4'/><path d='M9 8V6.2A1.7 1.7 0 0 1 10.7 4.5h2.6A1.7 1.7 0 0 1 15 6.2V8' fill='none' stroke='#ffffff' stroke-width='1.4' stroke-linecap='round'/><path d='M3.5 8h17' stroke='#92400e' stroke-width='1.6' stroke-linecap='round'/><path d='M10 11.5v5.5M14 11.5v5.5' stroke='#92400e' stroke-width='1.4' stroke-linecap='round'/></svg></span>",
  iconSize: [34, 26],
  iconAnchor: [17, 13],
})

function mkDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('mk-MK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function ContainersPage() {
  const { containers, setContainers, auth, awardPoints, t } = useApp()
  const containerKindLabel = (id) => t(`containerKind.${id || 'mesan'}`)
  const [toast, setToast] = useState('')
  const [statusSuccess, setStatusSuccess] = useState(null)

  // Кабаст отпад: на телефон (Android/iOS) отвора Calls и ѕвони директно;
  // на веб го копира бројот и известува дека е копиран.
  async function callBulkyLine() {
    if (isNativePlatform()) {
      window.location.href = `tel:${BULKY_PHONE_TEL}`
      return
    }
    try {
      await navigator.clipboard.writeText(BULKY_PHONE_DISPLAY)
      setToast(t('cont.phoneCopied', { phone: BULKY_PHONE_DISPLAY }))
    } catch {
      // Clipboard недостапен (стар прелистувач/без дозвола) — прикажи го бројот.
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
  // Јавни точки во живо од OpenStreetMap (преку backend, кеширано). Додека не
  // пристигнат (или ако backend е недостапен), се користи статичниот снимок.
  const [livePoints, setLivePoints] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    fetchContainerPoints(controller.signal).then((pts) => {
      setLivePoints(Array.isArray(pts) ? pts : [])
    })
    return () => controller.abort()
  }, [])

  const mapPoints = useMemo(() => {
    const byId = new Map(skopjeAllContainerPoints.map((p) => [p.id, p]))
    for (const p of livePoints || []) byId.set(p.id, p)
    return [...byId.values()]
  }, [livePoints])

  const recyclingPoints = useMemo(
    () => mapPoints.filter((p) => p.type === 'recycling_container'),
    [mapPoints],
  )
  const basketPoints = useMemo(
    () => mapPoints.filter((p) => p.type === 'waste_basket'),
    [mapPoints],
  )
  const disposalPoints = useMemo(
    () => mapPoints.filter((p) => p.type === 'waste_disposal'),
    [mapPoints],
  )
  const allMapPoints = useMemo(
    () => [...recyclingPoints, ...basketPoints, ...disposalPoints],
    [recyclingPoints, basketPoints, disposalPoints],
  )
  const activeContainerIssues = containers.filter((c) => c.issueOpen)
  // Решени пријави од граѓани — јавно видливи за сите (маркетинг: Град Скопје решава).
  const resolvedContainerReports = useMemo(
    () => containers.filter((c) => !c.issueOpen && (c.reportedBy || c.reportedById)),
    [containers],
  )

  async function resetIssue(id) {
    if (typeof id === 'string' && id.includes('-')) {
      try {
        await updateReportStatus(id, 'resolved')
      } catch {
        return
      }
    }
    const container = containers.find((c) => c.id === id)
    const loc = container?.area || t('admin.unknownLocation')
    const statusLabel = t('status.resolved')
    setContainers((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c
        if (c.issueOpen && !c.resolvedRewardGiven && c.reportedById && c.reportedById.includes('@')) awardPoints(c.reportedById, 2)
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
          <div>
              <CardTitle className='text-xl'>{t('cont.mapTitle')}</CardTitle>
              <CardDescription className='mt-1'>{t('cont.mapSubtitle')}</CardDescription>
            </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-4 rounded-xl bg-white/60 px-4 py-3 text-sm'>
            <span className='flex items-center gap-2 font-medium text-slate-700'>
              <span className='h-3 w-3 rounded-full bg-emerald-500 shadow-sm' />
              {t('cont.recyclingContainers')}
            </span>
            <span className='flex items-center gap-2 font-medium text-slate-700'>
              <span className='h-3 w-3 rounded-full bg-sky-500 shadow-sm' />
              {t('cont.publicBaskets')}
            </span>
            <span className='flex items-center gap-2 font-medium text-slate-700'>
              <span className='h-3 w-3 rounded-full bg-amber-500 shadow-sm' />
              {t('cont.wasteDisposals')}
            </span>
            <span className='ml-auto text-xs text-slate-500'>
              {t('cont.totalPoints', { n: allMapPoints.length })}
            </span>
          </div>

          <div className='app-map-shell'>
            <MapContainer
              center={[41.9981, 21.4254]}
              zoom={14}
              maxZoom={20}
              preferCanvas
              className='h-full w-full'
              zoomAnimation={false}
              markerZoomAnimation={false}
              fadeAnimation={false}
              inertia={false}
            >
              <MapLayers />
              {recyclingPoints.map((p) => (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={recyclingIcon}>
                  <Popup>
                    <p className='font-semibold'>{t('cont.recyclingContainer')}</p>
                    <p className='text-xs text-slate-600'>ID: {p.id}</p>
                    <p className='text-xs text-slate-600'>{t('cont.sourceLabel')}: {p.source}</p>
                  </Popup>
                </Marker>
              ))}
              {basketPoints.map((p) => (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={basketIcon}>
                  <Popup>
                    <p className='font-semibold'>{t('cont.publicBasket')}</p>
                    <p className='text-xs text-slate-600'>ID: {p.id}</p>
                    <p className='text-xs text-slate-600'>{t('cont.sourceLabel')}: {p.source}</p>
                  </Popup>
                </Marker>
              ))}
              {disposalPoints.map((p) => (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={disposalIcon}>
                  <Popup>
                    <p className='font-semibold'>{t('cont.wasteDisposal')}</p>
                    <p className='text-xs text-slate-600'>ID: {p.id}</p>
                    <p className='text-xs text-slate-600'>{t('cont.sourceLabel')}: {p.source}</p>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <p className='text-xs text-slate-400'>
            {t('cont.containersWord')}: {recyclingPoints.length + disposalPoints.length} • {t('cont.basketsWord')}: {basketPoints.length} · {t('cont.osmAttribution')}
          </p>
        </CardContent>
      </Card>

      {isAdminRole(auth.role) && activeContainerIssues.length > 0 && (
        <section className='space-y-4'>
          <div className='flex items-center justify-between'>
            <h2 className='text-xl font-bold text-slate-900'>{t('cont.activeIssues')}</h2>
            <span className='rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700'>
              {activeContainerIssues.length}
            </span>
          </div>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
            {activeContainerIssues.map((c) => (
              <article key={c.id} className='group rounded-2xl border border-amber-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5'>
                <div className='flex items-start justify-between gap-2'>
                  <p className='flex items-center gap-2 font-semibold text-slate-900'>
                    <MapPin className='h-4 w-4 shrink-0 text-emerald-500' />
                    {c.area}
                  </p>
                  <StatusBadge status='warning' />
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
                <div className='mt-4'>
                  <Button size='sm' className='w-full' onClick={() => resetIssue(c.id)}>
                    {t('cont.markResolved')}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

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
