import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { AppState, Subscription } from '@/types'
import { formatCNY } from '@shared/money'
import { DaysBadge } from '@/components/Badge/Badge'
import { EmptyState } from '@/components/EmptyState/EmptyState'
import { buildRenewalForecast } from '@/utils/forecast'
import { monthLabel } from '@/utils/format'
import './Dashboard.scss'

type DashboardProps = {
  state: AppState
  onAdd: () => void
  onSeed: () => void
  onRenew: (subscription: Subscription) => void
}

type SpendView = 'actual' | 'future'

const CATEGORY_COLORS = [
  '#4f46e5',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
  '#ec4899',
  '#84cc16',
]

type CategoryDatum = {
  name: string
  annualized: number
  monthly: number
  count: number
  percent: number
  color: string
}

type CategoryTooltipProps = {
  active?: boolean
  payload?: Array<{ payload?: CategoryDatum }>
}

function CategoryTooltip({ active, payload }: CategoryTooltipProps) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null

  return (
    <div className="cat-tooltip">
      <div className="cat-tooltip-head">
        <span className="legend-dot" style={{ background: item.color }} />
        <strong>{item.name}</strong>
      </div>
      <div className="cat-tooltip-row">
        <span>月均</span>
        <strong>{formatCNY(item.monthly)}</strong>
      </div>
      <div className="cat-tooltip-row">
        <span>占比</span>
        <span>
          {item.percent}% · {item.count} 个
        </span>
      </div>
    </div>
  )
}

export function Dashboard({ state, onAdd, onSeed, onRenew }: DashboardProps) {
  const { stats, subscriptions } = state
  const [spendView, setSpendView] = useState<SpendView>('actual')
  const futureSpend = useMemo(
    () => buildRenewalForecast(subscriptions, state.today, 12),
    [subscriptions, state.today],
  )

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

  const subscriptionById = new Map(subscriptions.map((sub) => [sub.id, sub]))
  const categorySum = stats.categories.reduce((sum, item) => sum + item.annualized, 0)
  const categoryTotal = Math.max(categorySum, 1)
  const categoryData: CategoryDatum[] = stats.categories.map((item, index) => ({
    name: item.category,
    annualized: item.annualized,
    monthly: Math.round(item.annualized / 12),
    count: item.count,
    percent: Math.round((item.annualized / categoryTotal) * 100),
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }))

  const activeSubscriptions = subscriptions.filter((sub) => sub.status === 'active')
  const activeMonthlyTotal = activeSubscriptions.reduce(
    (sum, sub) => sum + Math.round(sub.annualized / 12),
    0,
  )
  const topMembers = activeSubscriptions
    .map((sub) => ({ sub, monthly: Math.round(sub.annualized / 12) }))
    .filter((item) => item.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 6)
  const topMaxMonthly = Math.max(...topMembers.map((item) => item.monthly), 1)

  const spendData = spendView === 'actual' ? stats.monthlySpend : futureSpend
  const spendMax = Math.max(...spendData.map((item) => item.total), 1)
  const spendTotal = spendData.reduce((sum, item) => sum + item.total, 0)
  const spendIsEmpty = spendTotal === 0
  const spendTitle =
    spendView === 'actual' ? '近 12 个月实际支出' : '未来 12 个月预计续费'
  const spendDescription =
    spendView === 'actual'
      ? '按支付日统计，含所有状态'
      : '按下次续费日和计费周期估算，仅活跃会员'

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
            <div className="cat-chart">
              <div className="donut" aria-label="分类月均占比图">
                {categorySum > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart accessibilityLayer={false}>
                      <Pie
                        data={categoryData}
                        dataKey="annualized"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="62%"
                        outerRadius="95%"
                        paddingAngle={categoryData.length > 1 ? 1.5 : 0}
                        startAngle={90}
                        endAngle={-270}
                        rootTabIndex={-1}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {categoryData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CategoryTooltip />} cursor={false} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="donut-empty" />
                )}
                <div className="donut-center">
                  <span>月均合计</span>
                  <strong>{formatCNY(Math.round(categorySum / 12))}</strong>
                </div>
              </div>
              <div className="cat-legend">
                {categoryData.map((item) => (
                  <div className="cat-legend-row" key={item.name}>
                    <span
                      className="legend-dot"
                      style={{ background: item.color }}
                    />
                    <span className="legend-name">
                      {item.name}
                      <small>{item.count} 个</small>
                    </span>
                    <strong className="legend-value">
                      {formatCNY(item.monthly)}
                    </strong>
                    <span className="legend-pct">{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card card-pad">
        <div className="card-head">
          <div>
            <h2>会员月均 Top 6</h2>
            <p>只统计活跃会员，按月均成本排序</p>
          </div>
          <span className="count-pill">{formatCNY(activeMonthlyTotal)}/月</span>
        </div>
        {topMembers.length === 0 ? (
          <p className="muted pad-y">暂无有支付记录的活跃会员。</p>
        ) : (
          <div className="top-list">
            {topMembers.map((item, index) => {
              const share =
                activeMonthlyTotal > 0
                  ? Math.round((item.monthly / activeMonthlyTotal) * 100)
                  : 0
              return (
                <div className="top-row" key={item.sub.id}>
                  <div className="top-head">
                    <span className="top-name">
                      <em>{index + 1}</em>
                      <span className="top-service">{item.sub.serviceName}</span>
                      <small>{item.sub.planName}</small>
                    </span>
                    <span className="top-value">
                      <strong>{formatCNY(item.monthly)}</strong>
                      <small>/月 · {share}%</small>
                    </span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(2, (item.monthly / topMaxMonthly) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card card-pad">
        <div className="card-head spend-head">
          <div>
            <h2>{spendTitle}</h2>
            <p>{spendDescription}</p>
          </div>
          <div className="spend-head-right">
            <div className="spend-switch" role="tablist" aria-label="支出视图">
              <button
                type="button"
                role="tab"
                aria-selected={spendView === 'actual'}
                className={`spend-tab${spendView === 'actual' ? ' active' : ''}`}
                onClick={() => setSpendView('actual')}
              >
                实际支出
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={spendView === 'future'}
                className={`spend-tab${spendView === 'future' ? ' active' : ''}`}
                onClick={() => setSpendView('future')}
              >
                预计续费
              </button>
            </div>
            <span className="count-pill">{formatCNY(spendTotal)}</span>
          </div>
        </div>

        {spendIsEmpty ? (
          <p className="muted pad-y">
            {spendView === 'actual'
              ? '近 12 个月还没有支付记录。'
              : '当前没有可估算的续费。活跃会员需要已记录支付和下次续费日。'}
          </p>
        ) : (
          <div className={`bars${spendView === 'future' ? ' future' : ''}`}>
            {spendData.map((item, index) => (
              <div className="bar-col" key={item.month} tabIndex={0}>
                <div
                  className="bar"
                  style={{ height: `${Math.max(4, (item.total / spendMax) * 110)}px` }}
                >
                  <span className="bar-tip">
                    {item.month} · {formatCNY(item.total)}
                    {spendView === 'future' ? '（预计）' : ''}
                  </span>
                </div>
                <span className="bar-label">
                  {index % 2 === 0 || index === spendData.length - 1
                    ? monthLabel(item.month)
                    : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
