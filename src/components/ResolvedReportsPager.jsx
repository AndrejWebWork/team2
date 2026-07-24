import { useMemo } from 'react'
import { usePagination } from '../hooks/usePagination'
import { EmptyState } from './EmptyState'
import { PaginationControls } from './PaginationControls'

const PAGE_SIZE = 4

export function ResolvedReportsPager({
  title,
  subtitle,
  items,
  getSortTime = (item) => item.resolvedAt || item.createdAt || '',
  emptyTitle,
  emptyDescription,
  countLabel,
  renderItem,
  t,
}) {
  const sorted = useMemo(
    () => [...items].sort(
      (a, b) => new Date(getSortTime(b)).getTime() - new Date(getSortTime(a)).getTime(),
    ),
    [items],
  )

  const {
    visible,
    currentPage,
    totalPages,
    total,
    setPage,
    from,
    to,
  } = usePagination(sorted, PAGE_SIZE, sorted.length)

  const pagerProps = {
    total,
    countLabel,
    currentPage,
    totalPages,
    onPrev: () => setPage((p) => Math.max(0, p - 1)),
    onNext: () => setPage((p) => Math.min(totalPages - 1, p + 1)),
    t,
  }

  return (
    <section className='space-y-3 pb-2'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          {title && <h2 className='text-lg font-semibold text-slate-900 sm:text-xl'>{title}</h2>}
          {subtitle && <p className='mt-0.5 text-sm text-slate-500'>{subtitle}</p>}
        </div>
        <PaginationControls {...pagerProps} className='sm:ml-auto' />
      </div>

      {total === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {visible.map((item) => renderItem(item))}
          </div>
          {totalPages > 1 && (
            <div className='flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3'>
              <p className='text-xs text-slate-400'>
                {t('admin.showingRange', { from, to, total })}
              </p>
              <PaginationControls {...pagerProps} />
            </div>
          )}
        </>
      )}
    </section>
  )
}
