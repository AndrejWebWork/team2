import { ArrowLeft, Mail } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { IMPRESSUM_CREATORS, IMPRESSUM_TECH_CREDIT, impressumContent } from '../i18n/impressum'
import { LEGAL_CONTACT } from '../i18n/legal'
import euLogo from '../assets/logo-eu.jpg'
import leadLogo from '../assets/logo-lead.png'
import youthHubLogo from '../assets/logo-youthhub.png'
import { GRB_SRC } from '../lib/brand'

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
        <div className='flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:px-7'>
          <img src={GRB_SRC} alt={t('brand.coatAlt')} className='h-14 w-auto object-contain sm:h-16' draggable={false} />
          <div className='min-w-0'>
            <p className='font-display text-lg font-bold text-slate-900'>Еко Скопје</p>
            <p className='text-sm text-slate-500'>{t('brand.cityOfSkopje')}</p>
            <a
              href={`mailto:${LEGAL_CONTACT}`}
              className='mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800'
            >
              <Mail className='h-3.5 w-3.5' />
              {LEGAL_CONTACT}
            </a>
          </div>
        </div>

        <article className='space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7'>
          <h2 className='font-display text-xl font-bold leading-snug text-slate-900'>{content.headline}</h2>
          <div className='space-y-3'>
            {content.lead.map((para) => (
              <p key={para} className='text-sm leading-relaxed text-slate-600'>{para}</p>
            ))}
          </div>
          {content.sections.map((section) => (
            <section key={section.h} className='space-y-3'>
              <h3 className='text-base font-bold text-slate-900'>{section.h}</h3>
              {section.p.map((para) => (
                <p key={para} className='text-sm leading-relaxed text-slate-600'>{para}</p>
              ))}
              {section.bullets && (
                <ul className='list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600'>
                  {section.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
              {section.after && <p className='text-sm leading-relaxed text-slate-600'>{section.after}</p>}
            </section>
          ))}
          <section className='space-y-3'>
            <h3 className='text-base font-bold text-slate-900'>{content.projectTitle}</h3>
            <dl className='space-y-2 text-sm leading-relaxed text-slate-600'>
              {content.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className='font-semibold text-slate-800'>{fact.label}</dt>
                  <dd>
                    {fact.href ? (
                      <a href={fact.href} target='_blank' rel='noopener noreferrer' className='font-medium text-emerald-700 hover:text-emerald-800'>
                        {fact.value} ({fact.href.replace('https://', '')})
                      </a>
                    ) : fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <div className='flex flex-wrap items-center justify-center gap-x-8 gap-y-5 border-t border-slate-100 pt-6'>
            <a href='https://www.lead.org.mk' target='_blank' rel='noopener noreferrer' className='shrink-0'>
              <img src={leadLogo} alt='LEAD – Leaders for Education, Activism and Development' className='h-14 w-auto max-w-[11rem] object-contain sm:h-16' draggable={false} />
            </a>
            <img src={youthHubLogo} alt='YouthHUB Western Balkans and Turkey' className='h-11 w-auto max-w-[14rem] object-contain sm:h-12' draggable={false} />
            <img src={euLogo} alt='Funded by the European Union' className='h-10 w-auto max-w-[16rem] object-contain sm:h-12' draggable={false} />
          </div>
        </article>

        <article className='rounded-2xl border border-slate-200 bg-white p-5 sm:p-7'>
          <h2 className='text-sm font-semibold uppercase tracking-wide text-emerald-700'>{content.creatorsTitle}</h2>
          <ul className='mt-3 space-y-2'>
            {IMPRESSUM_CREATORS.map((name) => (
              <li key={name} className='text-sm font-medium text-slate-800'>{name}</li>
            ))}
          </ul>
          <p className='mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-400'>
            {IMPRESSUM_TECH_CREDIT[language] || IMPRESSUM_TECH_CREDIT.mk}
          </p>
        </article>
      </main>
    </div>
  )
}
