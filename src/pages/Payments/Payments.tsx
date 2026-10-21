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

type FlowTab = 'payments' | 'joint'

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
  const [flowTab, setFlowTab] = useState<FlowTab>('payments')
  const [paymentPage, setPaymentPage] = useState(1)
  const [paymentPageSize, setPaymentPageSize] = useState(10)
  const [jointPage, setJointPage] = useState(1)
  const [jointPageSize, setJointPageSize] = useState(10)
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

  const paymentTotal = list.reduce((sum, payment) => sum + payment.amount, 0)
  const paymentAverage = list.length > 0 ? Math.round(paymentTotal / list.length) : 0
  const jointTotal = jointRenewals.reduce((sum, renewal) => sum + renewal.total, 0)
  const jointAverage = jointRenewals.length > 0 ? Math.round(jointTotal / jointRenewals.length) : 0

  const paymentTotalPages = Math.max(1, Math.ceil(list.length / paymentPageSize))
  const currentPaymentPage = Math.min(paymentPage, paymentTotalPages)
  const paymentPageItems = list.slice(
    (currentPaymentPage - 1) * paymentPageSize,
    currentPaymentPage * paymentPageSize,
  )

  const jointTotalPages = Math.max(1, Math.ceil(jointRenewals.length / jointPageSize))
  const currentJointPage = Math.min(jointPage, jointTotalPages)
  const jointPageItems = jointRenewals.slice(
    (currentJointPage - 1) * jointPageSize,
    currentJointPage * jointPageSize,
  )

  const resetPages = () => {
    setPaymentPage(1)
    setJointPage(1)
  }

  const changeQuery = (value: string) => {
    setQuery(value)
    resetPages()
  }

  const changeFromDate = (value: string) => {
    setFromDate(value)
    resetPages()
  }

  const changeToDate = (value: string) => {
    setToDate(value)
    resetPages()
  }

  const clearDateRange = () => {
    setFromDate('')
    setToDate('')
    resetPages()
  }

  const clearFilters = () => {
    setQuery('')
    setFromDate('')
    setToDate('')
    resetPages()
  }

  const hasFilters = Boolean(keyword || fromDate || toDate)
  const hasAnything = state.payments.length > 0 || state.jointRenewals.length > 0

  const emptyDescription = (kind: FlowTab): string => {
    if (dateRangeInvalid) return '开始日期不能晚于结束日期。'
    if (keyword && (fromDate || toDate)) {
      return kind === 'payments'
        ? '当前搜索和日期范围内没有普通续费记录。'
        : '当前搜索和日期范围内没有联合续费记录。'
    }
    if (keyword) {
      return kind === 'payments'
        ? `会员名称里没有包含「${query.trim()}」的普通续费记录。`
        : `会员名称里没有包含「${query.trim()}」的联合续费记录。`
    }
    if (fromDate || toDate) {
      return kind === 'payments'
        ? '所选日期范围内没有普通续费记录。'
        : '所选日期范围内没有联合续费记录。'
    }
    return kind === 'payments'
      ? '在会员卡片上记录续费后，普通续费流水会出现在这里。'
      : '在会员页使用「联合续费」后，整条购买记录会出现在这里。'
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="inline-stats">
          {flowTab === 'payments' ? (
            <>
              <span>
                共 <strong>{list.length}</strong> 笔
              </span>
              <span>
                合计 <strong>{formatCNY(paymentTotal)}</strong>
              </span>
              <span>
                单笔均值 <strong>{formatCNY(paymentAverage)}</strong>
              </span>
            </>
          ) : (
            <>
              <span>
                共 <strong>{jointRenewals.length}</strong> 条
              </span>
              <span>
                合计 <strong>{formatCNY(jointTotal)}</strong>
              </span>
              <span>
                单条均值 <strong>{formatCNY(jointAverage)}</strong>
              </span>
            </>
          )}
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
          <div className="flow-tabs" role="tablist" aria-label="流水类型">
            <button
              type="button"
              role="tab"
              aria-selected={flowTab === 'payments'}
              className={`flow-tab${flowTab === 'payments' ? ' active' : ''}`}
              onClick={() => setFlowTab('payments')}
            >
              普通续费
              <span>{list.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={flowTab === 'joint'}
              className={`flow-tab${flowTab === 'joint' ? ' active' : ''}`}
              onClick={() => setFlowTab('joint')}
            >
              联合续费
              <span>{jointRenewals.length}</span>
            </button>
          </div>

          {flowTab === 'payments' ? (
            list.length === 0 ? (
              <div className="card card-pad">
                <EmptyState
                  title={hasFilters ? '没有找到普通续费记录' : '还没有普通续费记录'}
                  description={emptyDescription('payments')}
                  action={
                    hasFilters ? (
                      <button className="btn" onClick={clearFilters}>
                        清除筛选
                      </button>
                    ) : undefined
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
                  {paymentPageItems.map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} onDelete={onDelete} />
                  ))}
                </div>
                <Pagination
                  page={currentPaymentPage}
                  pageSize={paymentPageSize}
                  total={list.length}
                  onPageChange={setPaymentPage}
                  onPageSizeChange={setPaymentPageSize}
                />
              </>
            )
          ) : jointRenewals.length === 0 ? (
            <div className="card card-pad">
              <EmptyState
                title={hasFilters ? '没有找到联合续费记录' : '还没有联合续费记录'}
                description={emptyDescription('joint')}
                action={
                  hasFilters ? (
                    <button className="btn" onClick={clearFilters}>
                      清除筛选
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <div className="joint-renewal-list">
                {jointPageItems.map((renewal) => (
                  <JointRenewalCard
                    key={renewal.id}
                    renewal={renewal}
                    onDelete={onDeleteJointRenewal}
                  />
                ))}
              </div>
              <Pagination
                page={currentJointPage}
                pageSize={jointPageSize}
                total={jointRenewals.length}
                onPageChange={setJointPage}
                onPageSizeChange={setJointPageSize}
              />
            </>
          )}
        </>
      )}

      <p className="page-note">
        删除支付记录会改变对应会员的月均成本与累计支出，但不会自动改“下次续费日”。
        联合续费的支付请在「联合续费」里删除整条记录，删除后关联支付会一起消失，但同样不会回退到期日。
      </p>
    </div>
  )
}
