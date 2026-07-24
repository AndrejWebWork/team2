import { CalendarDays } from 'lucide-react'
import { Input } from './ui/input'
import { todayIso } from '../lib/dates'

export function EventDatePicker({ value, onChange, min, label, id = 'event-date', className }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className='mb-1.5 block text-sm font-medium text-slate-700'>
          {label}
        </label>
      )}
      <div className='relative'>
        <CalendarDays className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' aria-hidden />
        <Input
          id={id}
          type='date'
          value={value}
          min={min ?? todayIso()}
          onChange={(e) => onChange(e.target.value)}
          required
          className='pl-10 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer'
        />
      </div>
    </div>
  )
}
