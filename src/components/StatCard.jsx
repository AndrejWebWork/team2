import { Card, CardContent } from './ui/card'

export function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <Card className='transition-all duration-200 hover:shadow-md hover:-translate-y-0.5'>
      <CardContent className='p-5'>
        <div className='flex items-start justify-between'>
          <p className='text-sm font-medium text-slate-500'>{title}</p>
          {Icon ? (
            <span className='rounded-lg border border-slate-200 bg-slate-50 p-1.5'>
              <Icon className='h-4 w-4 text-slate-500' />
            </span>
          ) : null}
        </div>
        <p className='mt-3 font-display text-3xl font-bold leading-none text-slate-900'>{value}</p>
        {subtitle ? <p className='mt-1.5 text-xs text-slate-400'>{subtitle}</p> : null}
      </CardContent>
    </Card>
  )
}
