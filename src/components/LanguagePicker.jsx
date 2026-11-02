import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LANGUAGES } from '../i18n/translations'

const LANG_CODE = { mk: 'МК', en: 'EN', sq: 'SQ' }

export function LanguagePicker({ value, onChange, compact = false }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const current = LANGUAGES.find((l) => l.id === value) || LANGUAGES[0]

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className={`lang-picker${compact ? ' lang-picker-compact' : ''}${open ? ' is-open' : ''}`} ref={wrapRef}>
      <button
        type='button'
        className='lang-picker-trigger'
        aria-expanded={open}
        aria-haspopup='listbox'
        aria-label={current.label}
        onClick={() => setOpen((v) => !v)}
      >
        <span className='lang-picker-code'>{LANG_CODE[current.id] || current.id.toUpperCase()}</span>
        {!compact && (
          <span className='lang-picker-copy'>
            <span className='lang-picker-name'>{current.label}</span>
          </span>
        )}
        {!compact && <ChevronDown className='lang-picker-chevron' aria-hidden />}
      </button>
      <div className='lang-picker-menu' role='listbox' aria-label={current.label}>
        {LANGUAGES.map((l) => {
          const active = l.id === value
          return (
            <button
              key={l.id}
              type='button'
              role='option'
              aria-selected={active}
              className={`lang-picker-option${active ? ' is-active' : ''}`}
              onClick={() => {
                onChange(l.id)
                setOpen(false)
              }}
            >
              <span className='lang-picker-code'>{LANG_CODE[l.id] || l.id.toUpperCase()}</span>
              <span className='lang-picker-name'>{l.label}</span>
              <Check className='lang-picker-check' aria-hidden />
            </button>
          )
        })}
      </div>
    </div>
  )
}
