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
  const sorted = [...items].sort(
    (a, b) => new Date(getSortTime(b)).getTime() - new Date(getSortTime(a)).getTime(),
  )

  const {
    visible,
    currentPage,
    totalPages,
    total,
    setPage,
  } = usePagination(sorted, PAGE_SIZE, sorted.length)

  return (
    <section className='space-y-3 pb-2'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          {title && <h2 className='text-lg font-semibold text-slate-900 sm:text-xl'>{title}</h2>}
          {subtitle && <p className='mt-0.5 text-sm text-slate-500'>{subtitle}</p>}
        </div>
        <PaginationControls
          total={total}
          countLabel={countLabel}
          currentPage={currentPage}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          t={t}
          className='sm:ml-auto'
        />
      </div>

      {total === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          {visible.map((item) => renderItem(item))}
        </div>
      )}
    </section>
  )
}
