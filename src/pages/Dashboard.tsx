import type { AppState, Subscription } from '../types'
import { formatCNY } from '../../shared/money'
import { DaysBadge, EmptyState, monthLabel } from '../components/ui'

type DashboardProps = {
  state: AppState
  onAdd: () => void
  onSeed: () => void
  onRenew: (subscription: Subscription) => void
}

export function Dashboard({ state, onAdd, onSeed, onRenew }: DashboardProps) {
  const { stats, subscriptions } = state

  if (subscriptions.length === 0) {
    return (
      <div className="card card-pad">
        <EmptyState
          title="还没有记录任何会员"
          description="先添加一个正在付费的会员，或者载入一组示例数据看看统计效果。数据只保存在你本机的 data/app.db。"
          action={
            <div className="row gap-8">
              <button className="btn primary" onClick={onAdd}>
                添加第一个会员
              </button>
              <button className="btn" onClick={onSeed}>
                载入示例数据
              </button>
            </div>
          }
        />
      </div>
    )
  }

  const maxMonthly = Math.max(...stats.monthlySpend.map((item) => item.total), 1)
  const monthlyTotal = stats.monthlySpend.reduce((sum, item) => sum + item.total, 0)
  const categoryTotal = Math.max(
    stats.categories.reduce((sum, item) => sum + item.annualized, 0),
    1,
  )

  const subscriptionById = new Map(subscriptions.map((sub) => [sub.id, sub]))

  return (
    <div className="stack">
      <section className="kpi-grid">
        <div className="card kpi">
          <span className="kpi-label">月均订阅支出</span>
          <strong className="kpi-value">{formatCNY(stats.monthly)}</strong>
          <span className="kpi-sub">年均 {formatCNY(stats.annualized)}</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">活跃会员</span>
          <strong className="kpi-value">{stats.activeCount}</strong>
          <span className="kpi-sub">共 {subscriptions.length} 条记录</span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">30 天内到期</span>
          <strong className="kpi-value">{stats.upcoming30}</strong>
          <span className={`kpi-sub ${stats.expiredCount > 0 ? 'danger-text' : ''}`}>
            {stats.expiredCount > 0 ? `${stats.expiredCount} 个已过期` : '暂无过期'}
          </span>
        </div>
        <div className="card kpi">
          <span className="kpi-label">累计支出</span>
          <strong className="kpi-value">{formatCNY(stats.totalSpent)}</strong>
          <span className="kpi-sub">共 {state.payments.length} 笔支付</span>
        </div>
      </section>

      <section className="two-col">
        <div className="card card-pad">
          <div className="card-head">
            <div>
              <h2>未来 90 天续费</h2>
              <p>按最后支付日 + 计费周期推算</p>
            </div>
            <span className="count-pill">{stats.upcoming.length}</span>
          </div>

          {stats.upcoming.length === 0 ? (
            <p className="muted pad-y">90 天内没有需要续费的会员。</p>
          ) : (
            <div className="upcoming-list">
              {stats.upcoming.map((item) => {
                const sub = subscriptionById.get(item.subscriptionId)
                return (
                  <div className="upcoming-row" key={item.subscriptionId}>
                    <div className="date-box">
                      <strong>{item.date.slice(8)}</strong>
                      <span>{Number(item.date.slice(5, 7))}月</span>
                    </div>
                    <div className="upcoming-main">
                      <strong>{item.serviceName}</strong>
                      <span>
                        {item.planName}
                        {item.platform ? ` · ${item.platform}` : ''}
                      </span>
                    </div>
                    <div className="upcoming-amount">
                      <strong>{formatCNY(item.amount)}</strong>
                    </div>
                    <DaysBadge days={item.daysLeft} />
                    {sub ? (
                      <button className="btn sm" onClick={() => onRenew(sub)}>
                        记录
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <div>
              <h2>分类月均</h2>
              <p>只统计活跃会员</p>
            </div>
          </div>
          {stats.categories.length === 0 ? (
            <p className="muted pad-y">暂无活跃会员。</p>
          ) : (
            <div className="cat-list">
              {stats.categories.map((item) => (
                <div className="cat-row" key={item.category}>
                  <div className="cat-head">
                    <span>
                      {item.category}
                      <small>{item.count} 个</small>
                    </span>
                    <strong>{formatCNY(Math.round(item.annualized / 12))}</strong>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.max(2, (item.annualized / categoryTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card card-pad">
        <div className="card-head">
          <div>
            <h2>近 12 个月实际支出</h2>
            <p>按支付日统计，含所有状态</p>
          </div>
          <span className="count-pill">{formatCNY(monthlyTotal)}</span>
        </div>
        <div className="bars">
          {stats.monthlySpend.map((item, index) => (
            <div className="bar-col" key={item.month} tabIndex={0}>
              <div
                className="bar"
                style={{ height: `${Math.max(4, (item.total / maxMonthly) * 110)}px` }}
              >
                <span className="bar-tip">
                  {item.month} · {formatCNY(item.total)}
                </span>
              </div>
              <span className="bar-label">
                {index % 2 === 0 || index === stats.monthlySpend.length - 1
                  ? monthLabel(item.month)
                  : ''}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
