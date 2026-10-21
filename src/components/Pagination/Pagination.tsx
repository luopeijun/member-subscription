import { SelectMenu } from '@/components/SelectMenu/SelectMenu'
import './Pagination.scss'

type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  showPageSize?: boolean
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  showPageSize = true,
}: PaginationProps) {
  if (total === 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)

  const changeSize = (value: number) => {
    if (!onPageSizeChange) return
    onPageSizeChange(value)
    onPageChange(1)
  }

  return (
    <div className="pager">
      <div className="pager-left">
        <span className="pager-info">
          共 <strong>{total}</strong> 条
        </span>
        {showPageSize && onPageSizeChange ? (
          <span className="pager-size">
            每页
            <SelectMenu
              value={String(pageSize)}
              onChange={(value) => changeSize(Number(value))}
              ariaLabel="每页条数"
              size="sm"
              options={pageSizeOptions.map((size) => ({
                value: String(size),
                label: `${size} 条`,
              }))}
            />
          </span>
        ) : null}
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
