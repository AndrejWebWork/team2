import { ChevronLeft, ChevronRight } from 'lucide-react'

export function PaginationControls({
  total,
  countLabel,
  currentPage,
  totalPages,
  onPrev,
  onNext,
  t,
  className = '',
}) {
  if (total === 0) return null

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className='text-xs font-medium text-slate-500'>
        {total} {countLabel}
      </span>
      {totalPages > 1 && (
        <>
          <button
            type='button'
            disabled={currentPage === 0}
            onClick={onPrev}
            aria-label={t('common.pagePrev')}
            className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
          >
            <ChevronLeft className='h-4 w-4' />
          </button>
          <button
            type='button'
            disabled={currentPage >= totalPages - 1}
            onClick={onNext}
            aria-label={t('common.pageNext')}
            className='inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
          >
            <ChevronRight className='h-4 w-4' />
          </button>
        </>
      )}
    </div>
  )
}
