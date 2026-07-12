import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors', {
  variants: {
    variant: {
      default: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      secondary: 'border-slate-200 bg-slate-100 text-slate-600',
      warning: 'border-amber-200 bg-amber-50 text-amber-700',
      danger: 'border-rose-200 bg-rose-50 text-rose-700',
      destructive: 'border-rose-200 bg-rose-50 text-rose-700',
      outline: 'border-slate-300 bg-white text-slate-700',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
