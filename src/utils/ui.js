export const cx = (...classes) => classes.filter(Boolean).join(' ')

export function statusTone(status) {
  if (['good', 'resolved', 'open'].includes(status)) return 'border border-[#009688]/25 bg-[#009688]/10 text-[#007f73]'
  if (['moderate', 'pending', 'few_left', 'warning', 'in_progress'].includes(status)) return 'border border-[#2979FF]/25 bg-[#2979FF]/10 text-[#1f66de]'
  return 'border border-rose-200 bg-rose-100 text-rose-700'
}


