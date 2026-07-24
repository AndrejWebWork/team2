import { useEffect, useMemo, useState } from 'react'

export function usePagination(items, pageSize = 4, resetKey = '') {
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [resetKey])

  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages - 1)

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1))
  }, [page, totalPages])

  const visible = useMemo(
    () => items.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    [items, currentPage, pageSize],
  )

  return {
    visible,
    currentPage,
    totalPages,
    total,
    pageSize,
    setPage,
    from: total === 0 ? 0 : currentPage * pageSize + 1,
    to: Math.min(total, (currentPage + 1) * pageSize),
  }
}
