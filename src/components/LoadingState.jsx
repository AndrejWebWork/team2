export function LoadingState({ rows = 3 }) {
  return (
    <div className='space-y-3'>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className='h-14 animate-pulse rounded-xl bg-slate-200/70' />
      ))}
    </div>
  )
}
