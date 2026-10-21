import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AppState, Subscription } from '@/types'
import { formatCNY } from '@shared/money'
import { DaysBadge } from '@/components/Badge/Badge'
import { EmptyState } from '@/components/EmptyState/EmptyState'
import { buildRenewalForecast, type MonthlySpend } from '@/utils/forecast'
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
    <div className="chart-tooltip">
      <div className="chart-tooltip-head">
        <span className="legend-dot" style={{ background: item.color }} />
        <strong>{item.name}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>月均</span>
        <strong>{formatCNY(item.monthly)}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>占比</span>
        <span>
          {item.percent}% · {item.count} 个
        </span>
      </div>
    </div>
  )
}

type TopMemberDatum = {
  rank: number
  name: string
  planName: string
  monthly: number
  share: number
}

type TopMemberTickProps = {
  x?: number
  y?: number
  payload?: { index?: number }
}

type TopMemberTooltipProps = {
  active?: boolean
  payload?: Array<{ payload?: TopMemberDatum }>
}

type SpendTooltipProps = {
  active?: boolean
  payload?: Array<{ payload?: MonthlySpend }>
  view: SpendView
}

function truncateLabel(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

function TopMemberTooltip({ active, payload }: TopMemberTooltipProps) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-head">
        <span className="chart-tooltip-rank">#{item.rank}</span>
        <strong>{item.name}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>套餐</span>
        <span>{item.planName}</span>
      </div>
      <div className="chart-tooltip-row">
        <span>月均</span>
        <strong>{formatCNY(item.monthly)}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>占比</span>
        <span>{item.share}%</span>
      </div>
    </div>
  )
}

function SpendTooltip({ active, payload, view }: SpendTooltipProps) {
  const item = payload?.[0]?.payload
  if (!active || !item) return null

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-head">
        <strong>{item.month}</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>{view === 'future' ? '预计续费' : '实际支出'}</span>
        <strong>{formatCNY(item.total)}</strong>
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
  const topData: TopMemberDatum[] = topMembers.map((item, index) => ({
    rank: index + 1,
    name: item.sub.serviceName,
    planName: item.sub.planName,
    monthly: item.monthly,
    share:
      activeMonthlyTotal > 0
        ? Math.round((item.monthly / activeMonthlyTotal) * 100)
        : 0,
  }))
  const topMaxMonthly = Math.max(...topData.map((item) => item.monthly), 1)
  const renderTopTick = (props: unknown) => {
    const { x = 0, y = 0, payload } = props as TopMemberTickProps
    const item = topData[payload?.index ?? -1]
    if (!item) return null

    return (
      <g transform={`translate(${x}, ${y})`}>
        <circle className="top-tick-badge" cx={-112} cy={0} r={9} />
        <text className="top-tick-rank" x={-112} y={3.5} textAnchor="middle">
          {item.rank}
        </text>
        <text className="top-tick-name" x={-96} y={-2} textAnchor="start">
          {truncateLabel(item.name, 7)}
        </text>
        <text className="top-tick-plan" x={-96} y={11} textAnchor="start">
          {truncateLabel(item.planName, 9)}
        </text>
      </g>
    )
  }

  const spendData = spendView === 'actual' ? stats.monthlySpend : futureSpend
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
              <div
                className="donut chart-frame"
                role="img"
                aria-label="分类月均占比图"
              >
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
        {topData.length === 0 ? (
          <p className="muted pad-y">暂无有支付记录的活跃会员。</p>
        ) : (
          <div
            className="top-chart chart-frame"
            role="img"
            aria-label="会员月均支出 Top 6 柱状图"
          >
            <ResponsiveContainer
              width="100%"
              height={Math.max(92, topData.length * 38 + 8)}
            >
              <BarChart
                data={topData}
                layout="vertical"
                margin={{ top: 4, right: 76, bottom: 4, left: 0 }}
                barCategoryGap="30%"
                accessibilityLayer={false}
              >
                <defs>
                  <linearGradient id="topBarGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                </defs>
                <XAxis type="number" hide domain={[0, topMaxMonthly]} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={132}
                  axisLine={false}
                  tickLine={false}
                  tick={renderTopTick}
                />
                <Tooltip
                  content={<TopMemberTooltip />}
                  cursor={{ fill: '#f8f9fc' }}
                />
                <Bar
                  dataKey="monthly"
                  fill="url(#topBarGradient)"
                  radius={[0, 7, 7, 0]}
                  barSize={14}
                  background={{ fill: '#f1f3f7', radius: 999 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="monthly"
                    content={(props) => {
                      const { x = 0, y = 0, width = 0, height = 0, index } =
                        props as {
                          x?: number
                          y?: number
                          width?: number
                          height?: number
                          index?: number
                        }
                      const item = topData[index ?? -1]
                      if (!item) return null
                      return (
                        <g
                          transform={`translate(${x + width + 10}, ${y + height / 2})`}
                        >
                          <text className="top-label-value" x={0} y={-2}>
                            {formatCNY(item.monthly)}
                          </text>
                          <text className="top-label-share" x={0} y={11}>
                            {item.share}%
                          </text>
                        </g>
                      )
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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
          <div className="spend-chart chart-frame" role="img" aria-label={spendTitle}>
            <ResponsiveContainer width="100%" height={168}>
              <BarChart
                data={spendData}
                margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
                barCategoryGap="22%"
                accessibilityLayer={false}
              >
                <defs>
                  <linearGradient id="spendActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                  <linearGradient id="spendFuture" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5eead4" />
                    <stop offset="100%" stopColor="#0d9488" />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  height={24}
                  tickMargin={6}
                  tickFormatter={(value, index) =>
                    index % 2 === 0 || index === spendData.length - 1
                      ? monthLabel(String(value))
                      : ''
                  }
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                />
                <YAxis hide />
                <Tooltip
                  content={<SpendTooltip view={spendView} />}
                  cursor={{ fill: '#f8f9fc' }}
                />
                <Bar
                  dataKey="total"
                  fill={spendView === 'future' ? 'url(#spendFuture)' : 'url(#spendActual)'}
                  radius={[6, 6, 2, 2]}
                  minPointSize={4}
                  maxBarSize={40}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}
