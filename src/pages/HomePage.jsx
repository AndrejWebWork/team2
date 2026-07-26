import { BarChart3, Camera, Flame, MapPin, Plus, Recycle, SwitchCamera, Trash2, Wind, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { GPSStatus } from '../components/GPSStatus'
import { SubmitSuccessModal } from '../components/SubmitSuccessModal'
import { Toast } from '../components/Toast'
import { compressFromSource } from '../lib/photos'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { useApp } from '../context/AppContext'
import { useGeolocation } from '../hooks/useGeolocation'
import { LOGO_SRC } from '../lib/brand'
import { isValidReportType } from '../lib/reportTypes'

const MAX_PHOTOS = 6

function stopStream(stream) {
  stream?.getTracks?.().forEach((tr) => {
    try { tr.stop() } catch { /* ignore */ }
  })
}

function PhotoCapture({ photos, setPhotos, required, t }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [facingMode, setFacingMode] = useState('environment')
  const [flipping, setFlipping] = useState(false)
  const [toast, setToast] = useState('')

  async function startCamera(mode) {
    stopStream(streamRef.current)
    streamRef.current = null
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: mode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    }
    let s
    try {
      s = await navigator.mediaDevices.getUserMedia(constraints)
    } catch {
      // Fallback без ideal (постари iOS / Android WebView).
      s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: mode },
      })
    }
    streamRef.current = s
    setFacingMode(mode)
    setCameraOpen(true)
    // iOS WKWebView: srcObject мора после mount + muted + playsInline.
    requestAnimationFrame(() => {
      const video = videoRef.current
      if (!video) return
      video.srcObject = s
      video.muted = true
      video.setAttribute('playsinline', 'true')
      video.play?.().catch(() => {})
    })
  }

  async function openCamera() {
    try {
      await startCamera('environment')
    } catch {
      try {
        await startCamera('user')
      } catch {
        setToast(t('photo.cameraFail'))
      }
    }
  }

  function closeCamera() {
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOpen(false)
    setFlipping(false)
  }

  useEffect(() => () => stopStream(streamRef.current), [])

  async function flipCamera() {
    if (flipping) return
    setFlipping(true)
    const next = facingMode === 'environment' ? 'user' : 'environment'
    try {
      await startCamera(next)
    } catch {
      setToast(t('photo.flipFail'))
    } finally {
      setFlipping(false)
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const { dataUrl } = compressFromSource(video, video.videoWidth, video.videoHeight)
    setPhotos((prev) => (prev.length < MAX_PHOTOS ? [...prev, dataUrl] : prev))
    closeCamera()
  }

  function removePhoto(idx) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-medium text-slate-700'>
          {t('photo.photoLabel')}{' '}
          {required
            ? <span className='text-rose-500'>*</span>
            : <span className='font-normal text-slate-400'>{t('photo.optional')}</span>}
        </p>
        <span className='text-xs tabular-nums text-slate-400'>{photos.length}/{MAX_PHOTOS}</span>
      </div>

      {cameraOpen ? (
        <div className='space-y-2'>
          <div className='relative overflow-hidden rounded-xl border border-slate-200 bg-black'>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className='block w-full'
              style={{
                maxHeight: 320,
                // Предна камера често е mirrored во native apps.
                transform: facingMode === 'user' ? 'scaleX(-1)' : undefined,
              }}
            />
            <button
              type='button'
              onClick={flipCamera}
              disabled={flipping}
              aria-label={t('photo.flipCamera')}
              className='absolute bottom-3 right-3 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white shadow-lg backdrop-blur-sm transition active:scale-95 disabled:opacity-60'
            >
              <SwitchCamera className={`h-6 w-6 ${flipping ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className='flex gap-2'>
            <Button type='button' className='flex-1' onClick={capturePhoto}>
              <Camera className='h-4 w-4' />{t('photo.capture')}
            </Button>
            <Button type='button' variant='outline' onClick={closeCamera}>{t('common.cancel')}</Button>
          </div>
        </div>
      ) : (
        <div className='space-y-2'>
          {photos.length > 0 && (
            <div className='grid grid-cols-3 gap-2'>
              {photos.map((p, i) => (
                <div key={i} className='relative overflow-hidden rounded-xl border border-slate-200'>
                  <img src={p} alt={`${t('photo.preview')} ${i + 1}`} className='h-24 w-full object-cover' />
                  <button
                    type='button'
                    aria-label={t('common.close')}
                    onClick={() => removePhoto(i)}
                    className='absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white transition-colors hover:bg-rose-600'
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length < MAX_PHOTOS && (
            <Button type='button' variant='outline' className='w-full' onClick={openCamera}>
              {photos.length === 0
                ? <><Camera className='h-4 w-4' />{t('photo.openCamera')}</>
                : <><Plus className='h-4 w-4' />{t('photo.addPhoto')}</>}
            </Button>
          )}
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast('')} />
    </div>
  )
}


function SmellForm({ submitReport, onDone, loc, t }) {
  const [description, setDescription] = useState('')
  const [intensity, setIntensity] = useState(3)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (loc.loading) return setToast(t('form.waitingLocation'))
    const coords = await loc.ensureFresh()
    if (!coords?.lat) return setToast(t('form.locationUnavailable'))
    if (!description.trim()) return setToast(t('form.enterDescription'))
    setBusy(true)
    await submitReport({
      type: 'smell',
      location: coords.label,
      lat: coords.lat,
      lng: coords.lng,
      description: description.trim(),
      intensity,
      severity: intensity >= 4 ? 'critical' : 'warning',
    })
    setBusy(false)
    setDescription('')
    setIntensity(3)
    onDone()
  }

  return (
    <form onSubmit={submit} className='space-y-4'>
      <GPSStatus loc={loc} onRetry={loc.retry} onRefresh={loc.refresh} t={t} />

      <div>
        <p className='mb-2 text-sm font-medium text-slate-700'>{t('form.smellIntensity')}</p>
        <div className='flex gap-2'>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type='button'
              onClick={() => setIntensity(n)}
              className='flex flex-1 flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all duration-150'
              style={{
                borderColor: intensity >= n ? '#f97316' : '#e2e8f0',
                background: intensity >= n ? '#fff7ed' : '#f8fafc',
                color: intensity >= n ? '#ea580c' : '#94a3b8',
              }}
            >
              <Flame className='h-5 w-5' style={{ fill: intensity >= n ? '#fb923c' : 'none', color: intensity >= n ? '#ea580c' : '#cbd5e1' }} />
              {n}
            </button>
          ))}
        </div>
      </div>

      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('form.smellPlaceholder')} className='min-h-20' />
      <Button type='submit' className='w-full' disabled={loc.loading || busy}>{t('common.submitReport')}</Button>
      <Toast toast={toast} onClose={() => setToast('')} />
    </form>
  )
}

function DeponijForm({ submitReport, onDone, loc, t }) {
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([])
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (loc.loading) return setToast(t('form.waitingLocation'))
    const coords = await loc.ensureFresh()
    if (!coords?.lat) return setToast(t('form.locationUnavailable'))
    if (photos.length === 0) return setToast(t('deponija.photoRequired'))
    if (description.trim().length < 8) return setToast(t('deponija.descMin'))
    setBusy(true)
    await submitReport({
      type: 'waste',
      location: coords.label,
      lat: coords.lat,
      lng: coords.lng,
      description: description.trim(),
      dataUrls: photos,
    })
    setBusy(false)
    setDescription('')
    setPhotos([])
    onDone()
  }

  return (
    <form onSubmit={submit} className='space-y-4'>
      <GPSStatus loc={loc} onRetry={loc.retry} onRefresh={loc.refresh} t={t} />
      <PhotoCapture photos={photos} setPhotos={setPhotos} required t={t} />
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('deponija.descPlaceholder')} className='min-h-20' />
      <Button type='submit' className='w-full' disabled={loc.loading || busy}>{t('common.submitReport')}</Button>
      <Toast toast={toast} onClose={() => setToast('')} />
    </form>
  )
}

function ContainerForm({ submitReport, onDone, loc, t }) {
  const [containerKind, setContainerKind] = useState('mesan')
  const [issueType, setIssueType] = useState('full')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([])
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (loc.loading) return setToast(t('form.waitingLocation'))
    const coords = await loc.ensureFresh()
    if (!coords?.lat) return setToast(t('form.locationUnavailable'))
    setBusy(true)
    await submitReport({
      type: 'container',
      location: coords.label,
      lat: coords.lat,
      lng: coords.lng,
      description: description.trim(),
      containerKind,
      containerIssue: issueType,
      // Пополнетоста не се мери — не праќаме измислена вредност.
      fill: null,
      dataUrls: photos,
    })
    setBusy(false)
    setDescription('')
    setContainerKind('mesan')
    setIssueType('full')
    setPhotos([])
    onDone()
  }

  return (
    <form onSubmit={submit} className='space-y-4'>
      <GPSStatus loc={loc} onRetry={loc.retry} onRefresh={loc.refresh} t={t} />

      <div>
        <p className='mb-1.5 text-sm font-medium text-slate-700'>{t('container.type')}</p>
        <select value={containerKind} onChange={(e) => setContainerKind(e.target.value)} className='h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base'>
          <option value='mesan'>{t('containerKind.mesan')}</option>
          <option value='podzemen'>{t('containerKind.podzemen')}</option>
          <option value='kabast'>{t('containerKind.kabast')}</option>
        </select>
      </div>

      <div>
        <p className='mb-1.5 text-sm font-medium text-slate-700'>{t('container.problemType')}</p>
        <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className='h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base'>
          <option value='full'>{t('container.full')}</option>
          <option value='smell'>{t('container.smell')}</option>
          <option value='broken'>{t('container.broken')}</option>
        </select>
      </div>

      <PhotoCapture photos={photos} setPhotos={setPhotos} required={false} t={t} />

      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('container.descPlaceholder')} className='min-h-16' />
      <Button type='submit' className='w-full' disabled={loc.loading || busy}>{t('common.submitReport')}</Button>
      <Toast toast={toast} onClose={() => setToast('')} />
    </form>
  )
}

function HeroSection({ t }) {
  return (
    <div className='relative overflow-hidden rounded-b-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-5 py-8 text-white sm:px-10 sm:py-12 -mx-4 sm:-mx-6 md:-mx-8 -mt-5'>
      {/* blobs */}
      <div className='pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl' />
      <div className='pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-teal-300/20 blur-3xl' />

      <div className='relative flex flex-col-reverse items-start gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6'>
        <div className='min-w-0'>
          <h1 className='text-[clamp(1.5rem,5vw,2.25rem)] font-extrabold leading-tight tracking-tight'>
            {t('home.heroLine1')}<br />{t('home.heroLine2')}
          </h1>
          <p className='mt-3 max-w-md text-[clamp(0.875rem,2.5vw,1rem)] text-slate-300'>
            {t('home.heroSubtitle')}
          </p>
        </div>
        <img
          src={LOGO_SRC}
          alt='EkoSkopje'
          className='relative h-20 w-auto shrink-0 rounded-2xl bg-white px-4 py-3 object-contain sm:h-32 sm:px-5 sm:py-4'
        />
      </div>
    </div>
  )
}

const TYPES = [
  { value: 'smell', labelKey: 'home.typeSmell', icon: Wind, color: 'text-rose-700', border: 'border-rose-300', bg: 'bg-rose-100' },
  { value: 'deponija', labelKey: 'home.typeDeponija', icon: Trash2, color: 'text-amber-700', border: 'border-amber-300', bg: 'bg-amber-100' },
  { value: 'container', labelKey: 'home.typeContainer', icon: Recycle, color: 'text-emerald-700', border: 'border-emerald-300', bg: 'bg-emerald-100' },
]

export function HomePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { submitReport, auth, t } = useApp()
  const [type, setType] = useState('smell')
  const [submitted, setSubmitted] = useState(false)
  const [heroVisible, setHeroVisible] = useState(true)
  const reportSectionRef = useRef(null)
  const loc = useGeolocation(t)

  useEffect(() => {
    const paramType = searchParams.get('type')
    if (isValidReportType(paramType)) setType(paramType)
    if (isValidReportType(paramType) || window.location.hash === '#report') {
      requestAnimationFrame(() => {
        reportSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [searchParams])

  if (auth.role === 'admin') return <Navigate to='/admin-panel' replace />

  const handleDone = useCallback(() => setSubmitted(true), [])
  const navAir = useCallback(() => navigate('/air'), [navigate])
  const navWaste = useCallback(() => navigate('/waste'), [navigate])
  const navContainers = useCallback(() => navigate('/containers'), [navigate])
  const navAdminDesk = useCallback(() => navigate('/admin-desk'), [navigate])

  const selected = TYPES.find((opt) => opt.value === type)

  return (
    <div className='space-y-6'>
      {heroVisible && <HeroSection t={t} />}
      <Card id='report' ref={reportSectionRef}>
        <CardContent className='p-5 md:p-6'>
          <p className='font-display text-xl font-bold text-slate-900'>{t('home.reportProblem')}</p>
          <p className='mt-0.5 text-sm text-slate-500'>{t('home.reportSubtitle')}</p>

          <div className='mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3'>
            {TYPES.map((opt) => (
              <button
                key={opt.value}
                type='button'
                onClick={() => setType(opt.value)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all duration-150 ${
                  type === opt.value
                    ? `${opt.border} ${opt.bg} ${opt.color} shadow-sm ring-1 ring-black/5`
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <opt.icon className='h-4 w-4 shrink-0' />
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className='p-5'>
          <div className={`rounded-xl border p-4 transition-all duration-200 ${selected.border} ${selected.bg}`}>
            <p className={`mb-4 flex items-center gap-2 text-sm font-semibold ${selected.color}`}>
              <selected.icon className='h-4 w-4' />{t(selected.labelKey)}
            </p>

            {type === 'smell' && (
              <SmellForm submitReport={submitReport} onDone={handleDone} loc={loc} t={t} />
            )}
            {type === 'deponija' && (
              <DeponijForm submitReport={submitReport} onDone={handleDone} loc={loc} t={t} />
            )}
            {type === 'container' && (
              <ContainerForm submitReport={submitReport} onDone={handleDone} loc={loc} t={t} />
            )}
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>{t('home.statsMaps')}</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-2 sm:grid-cols-3'>
          <Button variant='outline' className='w-full justify-start' onClick={navAir}>
            <Wind className='h-4 w-4' />{t('home.air')}
          </Button>
          <Button variant='outline' className='w-full justify-start' onClick={navWaste}>
            <Trash2 className='h-4 w-4' />{t('home.dumps')}
          </Button>
          <Button variant='outline' className='w-full justify-start' onClick={navContainers}>
            <Recycle className='h-4 w-4' />{t('home.containers')}
          </Button>
          <Button variant='secondary' className='w-full justify-start sm:col-span-3' onClick={navAdminDesk}>
            <BarChart3 className='h-4 w-4' />{t('home.viewStats')}
          </Button>
        </CardContent>
      </Card>

      <SubmitSuccessModal open={submitted} onClose={() => setSubmitted(false)} />
    </div>
  )
}
