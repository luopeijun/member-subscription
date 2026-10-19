import { useMemo, useState } from 'react'
import type { AppState, JointRenewal, Payment } from '../types'
import { formatCNY } from '../../shared/money'
import { formatDuration } from '../../shared/duration'
import { EmptyState, formatDate } from '../components/ui'
import { Pagination } from '../components/Pagination'

type Props = {
  state: AppState
  onAdd: () => void
  onDelete: (payment: Payment) => void
  onDeleteJointRenewal: (jointRenewal: JointRenewal) => void
}

export function Payments({ state, onAdd, onDelete, onDeleteJointRenewal }: Props) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const keyword = query.trim().toLowerCase()

  const individualPayments = useMemo(
    () => state.payments.filter((payment) => payment.jointRenewalId === null),
    [state.payments],
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

  const jointRenewals = useMemo(
    () =>
      state.jointRenewals.filter((renewal) => {
        if (!keyword) return true
        const haystack = [
          renewal.mainServiceName,
          renewal.note,
          ...renewal.members.map((member) => member.serviceName),
          ...renewal.members.map((member) => member.planName),
        ]
        return haystack.some((value) => Boolean(value && value.toLowerCase().includes(keyword)))
      }),
    [state.jointRenewals, keyword],
  )

  const total = state.payments.reduce((sum, payment) => sum + payment.amount, 0)
  const average =
    state.payments.length > 0 ? Math.round(total / state.payments.length) : 0
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageItems = list.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const changeQuery = (value: string) => {
    setQuery(value)
    setPage(1)
  }

  const hasAnything = state.payments.length > 0 || state.jointRenewals.length > 0
  const hasMatches = jointRenewals.length > 0 || list.length > 0

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="inline-stats">
          <span>
            共 <strong>{state.payments.length}</strong> 笔
          </span>
          {state.jointRenewals.length > 0 ? (
            <span>
              联合续费 <strong>{state.jointRenewals.length}</strong> 条
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

      {!hasAnything ? (
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
      ) : (
        <>
          {!hasMatches ? (
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
          ) : null}

          {jointRenewals.length > 0 ? (
            <section className="stack">
              <h3 className="section-title">联合续费</h3>
              <div className="joint-renewal-list">
                {jointRenewals.map((renewal) => (
                  <article className="card joint-renewal-card" key={renewal.id}>
                    <div className="joint-renewal-head">
                      <div>
                        <strong>
                          {formatDate(renewal.paidAt)} · {renewal.members.length} 个会员
                        </strong>
                        <span>合计 {formatCNY(renewal.total)}</span>
                      </div>
                      <span className="badge joint">
                        {renewal.costMode === 'split' ? '均分' : '主会员承担'}
                      </span>
                    </div>
                    <div className="joint-renewal-members">
                      {renewal.members.map((member) => (
                        <span className="joint-renewal-member" key={member.subscriptionId}>
                          {member.serviceName}
                          <em>
                            {formatDuration(member.durationDays)} ·{' '}
                            {formatCNY(member.amount)}
                          </em>
                        </span>
                      ))}
                    </div>
                    <div className="joint-renewal-foot">
                      <span>
                        费用归属：{renewal.mainServiceName ?? '已删除会员'} ·{' '}
                        {renewal.costMode === 'split' ? '均分' : '主会员承担'}
                        {renewal.note ? ` · ${renewal.note}` : ''}
                      </span>
                      <button
                        className="btn sm danger"
                        onClick={() => onDeleteJointRenewal(renewal)}
                      >
                        删除记录
                      </button>
                    </div>
                  </article>
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
