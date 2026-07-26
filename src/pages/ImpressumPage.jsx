import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { IMPRESSUM_CREATORS, IMPRESSUM_SOURCE_URL, impressumContent } from '../i18n/impressum'

export function ImpressumPage() {
  const navigate = useNavigate()
  const { language, t } = useApp()
  const content = impressumContent[language] || impressumContent.mk

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/home')
  }

  return (
    <div className='min-h-screen bg-slate-50 app-safe-page'>
      <header className='app-safe-header sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur'>
        <div className='mx-auto flex max-w-3xl items-center gap-3 px-4 pb-3'>
          <button
            type='button'
            onClick={goBack}
            aria-label={t('impressum.back')}
            className='flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors active:bg-slate-100 hover:bg-slate-100'
          >
            <ArrowLeft className='h-5 w-5' />
          </button>
          <div className='min-w-0'>
            <h1 className='truncate text-lg font-bold text-slate-900'>{content.title}</h1>
            <p className='truncate text-xs text-slate-500'>{content.subtitle}</p>
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-3xl space-y-4 px-4 py-6'>
        <article className='rounded-2xl border border-slate-200 bg-white p-5 sm:p-7'>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-emerald-700'>{content.aboutTitle}</h2>
          <div className='mt-3 space-y-3'>
            {content.about.map((para, i) => (
              <p key={i} className='text-sm leading-relaxed text-slate-600'>{para}</p>
            ))}
          </div>
          <a
            href={IMPRESSUM_SOURCE_URL}
            target='_blank'
            rel='noopener noreferrer'
            className='mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800'
          >
            {content.sourceLabel}
            <ExternalLink className='h-3.5 w-3.5' />
          </a>
        </article>

        <article className='rounded-2xl border border-slate-200 bg-white p-5 sm:p-7'>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-emerald-700'>{content.creatorsTitle}</h2>
          <ul className='mt-3 space-y-2'>
            {IMPRESSUM_CREATORS.map((name) => (
              <li key={name} className='text-sm font-medium text-slate-800'>{name}</li>
            ))}
          </ul>
        </article>
      </main>
    </div>
  )
}
