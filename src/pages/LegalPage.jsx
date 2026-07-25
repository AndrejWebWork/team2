import { ArrowLeft, FileText, ShieldCheck, Database } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { LEGAL_UPDATED, legalContent } from '../i18n/legal'

const TABS = [
  { id: 'privacy', icon: ShieldCheck },
  { id: 'terms', icon: FileText },
  { id: 'attribution', icon: Database },
]

const TAB_LABEL = { privacy: 'legal.tabPrivacy', terms: 'legal.tabTerms', attribution: 'legal.tabAttribution' }

export function LegalPage() {
  const navigate = useNavigate()
  const { language, t } = useApp()
  const [params, setParams] = useSearchParams()

  const initial = TABS.some((x) => x.id === params.get('tab')) ? params.get('tab') : 'privacy'
  const [tab, setTab] = useState(initial)

  const content = legalContent[language] || legalContent.mk
  const doc = content[tab]

  function selectTab(id) {
    setTab(id)
    setParams({ tab: id }, { replace: true })
  }

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/settings')
  }

  return (
    <div className='min-h-screen bg-slate-50'>
      <header className='app-safe-header sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur'>
        <div className='mx-auto flex max-w-3xl items-center gap-3 px-4 pb-3'>
          <button
            type='button'
            onClick={goBack}
            aria-label={t('legal.back')}
            className='flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100'
          >
            <ArrowLeft className='h-5 w-5' />
          </button>
          <div className='min-w-0'>
            <h1 className='truncate text-lg font-bold text-slate-900'>{t('legal.title')}</h1>
            <p className='truncate text-xs text-slate-500'>{t('legal.subtitle')}</p>
          </div>
        </div>
        <div className='mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2'>
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type='button'
              onClick={() => selectTab(id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className='h-4 w-4' />
              {t(TAB_LABEL[id])}
            </button>
          ))}
        </div>
      </header>

      <main className='mx-auto max-w-3xl px-4 py-6'>
        <article className='rounded-2xl border border-slate-200 bg-white p-5 sm:p-7'>
          <h2 className='text-xl font-bold text-slate-900'>{doc.title}</h2>
          <p className='mt-1 text-xs text-slate-400'>
            {content.updatedLabel}: {LEGAL_UPDATED} · {content.operatorLabel}: Град Скопје
          </p>
          <div className='mt-5 space-y-6'>
            {doc.sections.map((s, i) => (
              <section key={i}>
                <h3 className='text-sm font-semibold uppercase tracking-wide text-emerald-700'>{s.h}</h3>
                <div className='mt-1.5 space-y-2'>
                  {s.p.map((para, j) => (
                    <p key={j} className='text-sm leading-relaxed text-slate-600'>{para}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
    </div>
  )
}
