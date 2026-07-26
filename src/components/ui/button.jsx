import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow-md',
        secondary: 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm hover:shadow-md',
        outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        destructive: 'bg-rose-600 text-white hover:bg-rose-700',
        info: 'bg-sky-100 text-sky-800 border border-sky-200 hover:bg-sky-200',
        warning: 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-xl px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

const Button = React.forwardRef(({ className, variant, size, onPointerUp, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(buttonVariants({ variant, size, className }))}
    {...props}
    onPointerUp={(e) => {
      onPointerUp?.(e)
      // Avoid sticky hover/focus highlight after tap on touch devices
      requestAnimationFrame(() => e.currentTarget?.blur())
    }}
  />
))
Button.displayName = 'Button'

export { Button, buttonVariants }
