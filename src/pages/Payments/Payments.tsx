import { useMemo, useState } from 'react'
import type { AppState, JointRenewal, Payment } from '@/types'
import { formatCNY } from '@shared/money'
import { EmptyState } from '@/components/EmptyState/EmptyState'
import { Pagination } from '@/components/Pagination/Pagination'
import { SearchBox } from '@/components/SearchBox/SearchBox'
import { JointRenewalCard } from './JointRenewalCard'
import { PaymentRow } from './PaymentRow'
import './Payments.scss'

type PaymentsProps = {
  state: AppState
  onDelete: (payment: Payment) => void
  onDeleteJointRenewal: (jointRenewal: JointRenewal) => void
}

function inDateRange(paidAt: string, fromDate: string, toDate: string): boolean {
  if (fromDate && toDate && fromDate > toDate) return false
  if (fromDate && paidAt < fromDate) return false
  if (toDate && paidAt > toDate) return false
  return true
}

export function Payments({ state, onDelete, onDeleteJointRenewal }: PaymentsProps) {
  const [query, setQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const keyword = query.trim().toLowerCase()
  const dateRangeInvalid = Boolean(fromDate && toDate && fromDate > toDate)

  const dateScopedPayments = useMemo(
    () => state.payments.filter((payment) => inDateRange(payment.paidAt, fromDate, toDate)),
    [state.payments, fromDate, toDate],
  )

  const individualPayments = useMemo(
    () => dateScopedPayments.filter((payment) => payment.jointRenewalId === null),
    [dateScopedPayments],
  )

  const list = useMemo(
    () =>
      individualPayments.filter(
        (payment) =>
          !keyword ||
          payment.serviceName.toLowerCase().includes(keyword) ||
          payment.planName.toLowerCase().includes(keyword),
      ),
    [individualPayments, keyword],
  )

  const dateScopedJointRenewals = useMemo(
    () => state.jointRenewals.filter((renewal) => inDateRange(renewal.paidAt, fromDate, toDate)),
    [state.jointRenewals, fromDate, toDate],
  )

  const jointRenewals = useMemo(
    () =>
      dateScopedJointRenewals.filter((renewal) => {
        if (!keyword) return true
        const haystack = [
          renewal.mainServiceName,
          renewal.note,
          ...renewal.members.map((member) => member.serviceName),
          ...renewal.members.map((member) => member.planName),
        ]
        return haystack.some((value) => Boolean(value && value.toLowerCase().includes(keyword)))
      }),
    [dateScopedJointRenewals, keyword],
  )

  const total = dateScopedPayments.reduce((sum, payment) => sum + payment.amount, 0)
  const average =
    dateScopedPayments.length > 0 ? Math.round(total / dateScopedPayments.length) : 0
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = list.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const changeQuery = (value: string) => {
    setQuery(value)
    setPage(1)
  }

  const changeFromDate = (value: string) => {
    setFromDate(value)
    setPage(1)
  }

  const changeToDate = (value: string) => {
    setToDate(value)
    setPage(1)
  }

  const clearDateRange = () => {
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const clearFilters = () => {
    setQuery('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const hasFilters = Boolean(keyword || fromDate || toDate)
  const hasAnything = state.payments.length > 0 || state.jointRenewals.length > 0
  const hasMatches = jointRenewals.length > 0 || list.length > 0

  return (
    <div className="stack payments-page">
      <div className="toolbar">
        <div className="inline-stats">
          <span>
            共 <strong>{dateScopedPayments.length}</strong> 笔
          </span>
          {dateScopedJointRenewals.length > 0 ? (
            <span>
              联合续费 <strong>{dateScopedJointRenewals.length}</strong> 条
            </span>
          ) : null}
          <span>
            合计 <strong>{formatCNY(total)}</strong>
          </span>
          <span>
            单笔均值 <strong>{formatCNY(average)}</strong>
          </span>
        </div>
        <div className="toolbar-right">
          <div
            className={`date-range${dateRangeInvalid ? ' invalid' : ''}`}
            title={dateRangeInvalid ? '开始日期不能晚于结束日期' : undefined}
          >
            <span className="date-range-label">支付日期</span>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => changeFromDate(event.target.value)}
              aria-label="开始日期"
            />
            <span className="date-range-sep">至</span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => changeToDate(event.target.value)}
              aria-label="结束日期"
            />
            {fromDate || toDate ? (
              <button
                type="button"
                className="date-range-clear"
                onClick={clearDateRange}
                aria-label="清除日期筛选"
              >
                ×
              </button>
            ) : null}
          </div>
          <SearchBox
            value={query}
            onChange={changeQuery}
            placeholder="搜索会员名称"
          />
        </div>
      </div>

      {!hasAnything ? (
        <div className="card card-pad">
          <EmptyState
            title="还没有支付流水"
            description="在会员页续费后，支付流水会出现在这里，可以查看涨价和实际月均成本。"
          />
        </div>
      ) : (
        <>
          {!hasMatches ? (
            <div className="card card-pad">
              <EmptyState
                title="没有找到匹配的流水"
                description={
                  dateRangeInvalid
                    ? '开始日期不能晚于结束日期。'
                    : keyword && (fromDate || toDate)
                      ? '当前搜索和日期范围内没有支付记录。'
                      : keyword
                        ? `会员名称里没有包含「${query.trim()}」的支付记录。`
                        : '所选日期范围内没有支付记录。'
                }
                action={
                  hasFilters ? (
                    <button className="btn" onClick={clearFilters}>
                      清除筛选
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : null}

          {jointRenewals.length > 0 ? (
            <section className="stack">
              <h3 className="section-title">联合续费</h3>
              <div className="joint-renewal-list">
                {jointRenewals.map((renewal) => (
                  <JointRenewalCard
                    key={renewal.id}
                    renewal={renewal}
                    onDelete={onDeleteJointRenewal}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {list.length > 0 ? (
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
                  <PaymentRow key={payment.id} payment={payment} onDelete={onDelete} />
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
          ) : null}
        </>
      )}

      <p className="page-note">
        删除支付记录会改变对应会员的月均成本与累计支出，但不会自动改“下次续费日”。
        联合续费的支付请在「联合续费」里删除整条记录，删除后关联支付会一起消失，但同样不会回退到期日。
      </p>
    </div>
  )
}
