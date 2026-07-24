import { CalendarDays } from 'lucide-react'
import { cn } from '../lib/utils'
import { Input } from './ui/input'
import { todayIso } from '../lib/dates'

const SIZE = {
  default: {
    wrap: '',
    icon: 'left-3 h-4 w-4',
    input: 'h-11 pl-10 text-sm',
  },
  lg: {
    wrap: 'rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40 p-3',
    icon: 'left-5 h-5 w-5 text-emerald-600',
    input: 'event-date-input h-12 pl-12 text-base font-medium sm:h-[3.25rem] sm:text-[1.05rem]',
  },
}

export function EventDatePicker({
  value,
  onChange,
  min,
  label,
  id = 'event-date',
  className,
  size = 'default',
}) {
  const s = SIZE[size] || SIZE.default

  return (
    <div className={cn(className)}>
      {label && (
        <label htmlFor={id} className='mb-1.5 block text-sm font-medium text-slate-700'>
          {label}
        </label>
      )}
      <div className={cn('relative', s.wrap)}>
        <CalendarDays
          className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2', s.icon)}
          aria-hidden
        />
        <Input
          id={id}
          type='date'
          value={value}
          min={min ?? todayIso()}
          onChange={(e) => onChange(e.target.value)}
          required
          className={cn(
            s.input,
            '[color-scheme:light]',
            size === 'lg' && 'border-emerald-200/80 bg-white shadow-sm focus-visible:border-emerald-400 focus-visible:ring-emerald-200',
            '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
            size === 'lg' && '[&::-webkit-calendar-picker-indicator]:ml-1 [&::-webkit-calendar-picker-indicator]:h-5 [&::-webkit-calendar-picker-indicator]:w-5 [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100',
          )}
        />
      </div>
    </div>
  )
}
