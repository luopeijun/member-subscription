import { useMemo, useState } from 'react'
import type { AppState, Subscription } from '../types'
import { formatCNY } from '../../shared/money'
import {
  DaysBadge,
  EmptyState,
  StatusBadge,
  cycleLabel,
  formatDate,
} from '../components/ui'

type Props = {
  state: AppState
  onAdd: () => void
  onJointRenew: () => void
  onEdit: (subscription: Subscription) => void
  onRenew: (subscription: Subscription) => void
  onDelete: (subscription: Subscription) => void
}

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '活跃' },
  { value: 'planned', label: '想买' },
  { value: 'expired', label: '已过期' },
] as const

const STATUS_ORDER: Record<string, number> = { active: 0, planned: 1, expired: 2 }

type Filter = (typeof FILTERS)[number]['value']

export function Subscriptions({
  state,
  onAdd,
  onJointRenew,
  onEdit,
  onRenew,
  onDelete,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const keyword = query.trim().toLowerCase()

  const list = useMemo(() => {
    const filtered = state.subscriptions.filter((sub) => {
      if (filter !== 'all' && sub.status !== filter) return false
      if (!keyword) return true
      return [
        sub.serviceName,
        sub.planName,
        sub.platform,
        sub.sharedWith,
        sub.account,
        sub.note,
      ].some((value) => Boolean(value && value.toLowerCase().includes(keyword)))
    })

    return [...filtered].sort((a, b) => {
      if (a.status !== b.status) {
        return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
      }
      if (a.nextRenewalAt && b.nextRenewalAt) {
        return a.nextRenewalAt.localeCompare(b.nextRenewalAt)
      }
      if (a.nextRenewalAt) return -1
      if (b.nextRenewalAt) return 1
      return a.serviceName.localeCompare(b.serviceName)
    })
  }, [state.subscriptions, filter, keyword])

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="chips">
          {FILTERS.map((item) => {
            const count =
              item.value === 'all'
                ? state.subscriptions.length
                : state.subscriptions.filter((sub) => sub.status === item.value).length
            return (
              <button
                key={item.value}
                className={`chip ${filter === item.value ? 'active' : ''}`}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="toolbar-right">
          <div className="search-box">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索会员名称或备注"
              aria-label="搜索会员名称或备注"
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
          <button className="btn" onClick={onJointRenew}>
            联合续费
          </button>
          <button className="btn primary" onClick={onAdd}>
            + 添加会员
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            title={
              keyword
                ? '没有找到匹配的会员'
                : filter === 'all'
                  ? '还没有会员记录'
                  : '这个状态下没有记录'
            }
            description={
              keyword
                ? `名称、平台或备注里没有包含「${query.trim()}」的记录。`
                : filter === 'all'
                  ? '添加会员时顺手记录一次实际支付，后续每次续费再补一笔，统计就会自动滚起来。'
                  : '切换筛选条件看看。'
            }
            action={
              keyword ? (
                <button className="btn" onClick={() => setQuery('')}>
                  清除搜索
                </button>
              ) : filter === 'all' ? (
                <button className="btn primary" onClick={onAdd}>
                  添加会员
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="sub-grid">
          {list.map((sub) => (
            <article className="card sub-card" key={sub.id}>
              <header className="sub-head">
                <div>
                  <h3>{sub.serviceName}</h3>
                  <p>
                    {sub.planName} · {cycleLabel(sub.cycleMonths)}
                  </p>
                </div>
                <StatusBadge status={sub.status} />
              </header>

              <div className="tag-row">
                <span className="badge muted">{sub.platform ?? '平台未记录'}</span>
                {sub.autoRenew ? (
                  <span className="badge info">自动续费</span>
                ) : (
                  <span className="badge muted">手动续费</span>
                )}
                {sub.sharedWith ? <span className="badge muted">{sub.sharedWith}</span> : null}
                {sub.note ? <span className="badge muted">{sub.note}</span> : null}
              </div>

              <div className="sub-price">
                <div>
                  <span>最近支付</span>
                  <strong>
                    {sub.lastPayment ? formatCNY(sub.lastPayment.amount) : '—'}
                  </strong>
                  <small>
                    {sub.lastPayment
                      ? formatDate(sub.lastPayment.paidAt)
                      : sub.status === 'planned'
                        ? '还没买'
                        : '未记录支付'}
                  </small>
                </div>
                <div>
                  <span>月均成本</span>
                  <strong>
                    {sub.status === 'planned'
                      ? '—'
                      : sub.cycleMonths <= 0
                        ? cycleLabel(sub.cycleMonths)
                        : formatCNY(Math.round(sub.annualized / 12))}
                  </strong>
                  <small>
                    {sub.status === 'planned'
                      ? '尚未产生支出'
                      : `累计 ${formatCNY(sub.totalSpent)} · ${sub.paymentCount} 笔`}
                  </small>
                </div>
              </div>

              {sub.priceChangePct !== null && Math.abs(sub.priceChangePct) >= 0.001 ? (
                <div
                  className={`price-change ${sub.priceChangePct > 0 ? 'up' : 'down'}`}
                >
                  较上次续费 {sub.priceChangePct > 0 ? '上涨' : '下降'}{' '}
                  {Math.abs(sub.priceChangePct * 100).toFixed(1)}%
                  {sub.lastPayment && sub.prevPayment
                    ? `（${formatCNY(sub.prevPayment.amount)} → ${formatCNY(
                        sub.lastPayment.amount,
                      )}）`
                    : ''}
                </div>
              ) : null}

              <div className="sub-renewal">
                {sub.nextRenewalAt ? (
                  <>
                    <div>
                      <span>{sub.status === 'active' ? '下次续费' : '到期日'}</span>
                      <strong>{formatDate(sub.nextRenewalAt)}</strong>
                    </div>
                    {sub.status === 'active' ? (
                      sub.daysLeft !== null ? <DaysBadge days={sub.daysLeft} /> : null
                    ) : sub.daysLeft !== null && sub.daysLeft < 0 ? (
                      <span className="badge muted">
                        已过期 {Math.abs(sub.daysLeft)} 天
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="muted">
                    {sub.status === 'planned'
                      ? '想买但还没买，点「记一笔购买」开始记录'
                      : sub.status === 'active'
                        ? sub.cycleMonths === -1
                          ? '买断，永久有效'
                          : '一次性付费，无后续扣款'
                        : '无到期记录'}
                  </span>
                )}
              </div>

              <footer className="sub-actions">
                <button className="btn sm" onClick={() => onRenew(sub)}>
                  {sub.status === 'planned' ? '记一笔购买' : '记一笔续费'}
                </button>
                <button className="btn sm" onClick={() => onEdit(sub)}>
                  编辑
                </button>
                <button className="btn sm danger" onClick={() => onDelete(sub)}>
                  删除
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
