import { useMemo, useState } from 'react'
import type { AppState, Payment } from '../types'
import { formatCNY } from '../../shared/money'
import { EmptyState } from '../ui'
import { Pagination } from '../components/Pagination'

type Props = {
  state: AppState
  onAdd: () => void
  onDelete: (payment: Payment) => void
}

export function Payments({ state, onAdd, onDelete }: Props) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const keyword = query.trim().toLowerCase()

  const list = useMemo(
    () =>
      state.payments.filter(
        (payment) =>
          !keyword ||
          payment.serviceName.toLowerCase().includes(keyword) ||
          payment.planName.toLowerCase().includes(keyword),
      ),
    [state.payments, keyword],
  )

  const total = list.reduce((sum, payment) => sum + payment.amount, 0)
  const average = list.length > 0 ? Math.round(total / list.length) : 0
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = list.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const changeQuery = (value: string) => {
    setQuery(value)
    setPage(1)
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="inline-stats">
          <span>
            共 <strong>{list.length}</strong> 笔
          </span>
          <span>
            合计 <strong>{formatCNY(total)}</strong>
          </span>
          <span>
            单笔均值 <strong>{formatCNY(average)}</strong>
          </span>
        </div>
        <div className="toolbar-right">
          <div className="search-box">
            <input
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              placeholder="搜索会员名称"
              aria-label="搜索会员名称"
            />
            {query ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery('')}
                aria-label="清除搜索"
              >
                ×
              </button>
            ) : null}
          </div>
          <button className="btn primary" onClick={onAdd} disabled={state.subscriptions.length === 0}>
            + 记一笔支付
          </button>
        </div>
      </div>

      {state.payments.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            title="还没有支付流水"
            description="每次续费后记一笔，能从流水里看到涨价和实际月均成本。"
            action={
              <button
                className="btn primary"
                onClick={onAdd}
                disabled={state.subscriptions.length === 0}
              >
                记一笔支付
              </button>
            }
          />
        </div>
      ) : list.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            title="没有找到匹配的流水"
            description={`会员名称里没有包含「${query.trim()}」的支付记录。`}
            action={
              <button className="btn" onClick={() => setQuery('')}>
                清除搜索
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="pay-list">
            <div className="pay-head" aria-hidden="true">
              <span>支付日期</span>
              <span>会员</span>
              <span className="num">金额</span>
              <span>备注</span>
              <span />
            </div>
            {pageItems.map((payment) => (
              <div className="pay-row" key={payment.id}>
                <span className="pay-date nowrap">{payment.paidAt}</span>
                <div className="pay-member">
                  <div className="cell-strong">{payment.serviceName}</div>
                  <div className="cell-sub">{payment.planName}</div>
                </div>
                <span className="pay-amount num nowrap">{formatCNY(payment.amount)}</span>
                <span className="pay-note muted">{payment.note ?? '—'}</span>
                <span className="pay-actions num">
                  <button className="btn sm danger" onClick={() => onDelete(payment)}>
                    删除
                  </button>
                </span>
              </div>
            ))}
          </div>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={list.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      <p className="page-note">
        删除支付记录会改变对应会员的月均成本与累计支出，但不会自动改“下次续费日”。
        如果误删了最近一笔，记得在会员编辑里覆盖下次续费日期。
      </p>
    </div>
  )
}
