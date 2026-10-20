import './Pagination.scss'

type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSizeOptions?: number[]
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
}: PaginationProps) {
  if (total === 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)

  const changeSize = (value: number) => {
    onPageSizeChange(value)
    onPageChange(1)
  }

  return (
    <div className="pager">
      <div className="pager-left">
        <span className="pager-info">
          共 <strong>{total}</strong> 条
        </span>
        <label className="pager-size">
          每页
          <select
            value={pageSize}
            onChange={(event) => changeSize(Number(event.target.value))}
            aria-label="每页条数"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} 条
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="pager-right">
        <button className="pager-btn" onClick={() => onPageChange(1)} disabled={current === 1}>
          首页
        </button>
        <button
          className="pager-btn"
          onClick={() => onPageChange(current - 1)}
          disabled={current === 1}
        >
          上一页
        </button>
        <span className="pager-current">
          第 <strong>{current}</strong> / {totalPages} 页
        </span>
        <button
          className="pager-btn"
          onClick={() => onPageChange(current + 1)}
          disabled={current === totalPages}
        >
          下一页
        </button>
        <button
          className="pager-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={current === totalPages}
        >
          末页
        </button>
      </div>
    </div>
  )
}
