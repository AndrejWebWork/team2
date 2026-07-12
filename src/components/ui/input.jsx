import * as React from 'react'
import { cn } from '../../lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return <input type={type} className={cn('flex h-11 w-full rounded-xl border border-slate-300/90 bg-white/90 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50', className)} ref={ref} {...props} />
})
Input.displayName = 'Input'

export { Input }
