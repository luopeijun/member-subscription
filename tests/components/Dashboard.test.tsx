// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '@/pages/Dashboard/Dashboard'
import {
  makeAppState,
  makeStats,
  makeSubscription,
} from '../fixtures'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(cleanup)

afterAll(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function makeDashboardState() {
  const subscription = makeSubscription({
    id: 1,
    serviceName: 'Netflix',
    planName: '高级会员',
    annualized: 12000,
    nextRenewalAt: '2026-11-01',
    daysLeft: 11,
    platform: '官网',
  })

  return makeAppState({
    subscriptions: [subscription],
    payments: [
      {
        id: 1,
        subscriptionId: 1,
        serviceName: 'Netflix',
        planName: '高级会员',
        paidAt: '2026-10-01',
        amount: 1000,
        note: null,
        jointRenewalId: null,
      },
    ],
    stats: makeStats({
      activeCount: 1,
      annualized: 12000,
      monthly: 1000,
      totalSpent: 1000,
      upcoming30: 1,
      categories: [
        { category: '影音娱乐', annualized: 12000, count: 1 },
      ],
      monthlySpend: [{ month: '2026-10', total: 1000 }],
      upcoming: [
        {
          subscriptionId: 1,
          serviceName: 'Netflix',
          planName: '高级会员',
          date: '2026-11-01',
          daysLeft: 11,
          amount: 1000,
          platform: '官网',
          autoRenew: true,
        },
      ],
    }),
  })
}

describe('Dashboard', () => {
  it('shows KPIs, charts, and upcoming renewals', async () => {
    const user = userEvent.setup()
    const onRenew = vi.fn()
    const state = makeDashboardState()

    render(
      <Dashboard
        state={state}
        onAdd={vi.fn()}
        onSeed={vi.fn()}
        onRenew={onRenew}
      />,
    )

    expect(screen.getByText('月均订阅支出')).toBeInTheDocument()
    expect(screen.getByText('活跃会员')).toBeInTheDocument()
    expect(screen.getByText('30 天内到期')).toBeInTheDocument()
    expect(screen.getByText('累计支出')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '分类月均占比图' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '会员月均支出 Top 6 柱状图' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Netflix').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: '记录' }))

    expect(onRenew).toHaveBeenCalledWith(state.subscriptions[0])
  })

  it('switches between actual and future spend views', async () => {
    const user = userEvent.setup()

    render(
      <Dashboard
        state={makeDashboardState()}
        onAdd={vi.fn()}
        onSeed={vi.fn()}
        onRenew={vi.fn()}
      />,
    )

    expect(screen.getByText('近 12 个月实际支出')).toBeInTheDocument()
    expect(screen.getByText('按支付日统计，含所有状态')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '实际支出' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await user.click(screen.getByRole('tab', { name: '预计续费' }))

    expect(screen.getByText('未来 12 个月预计续费')).toBeInTheDocument()
    expect(
      screen.getByText('按下次续费日和计费周期估算，仅活跃会员'),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '预计续费' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('shows the empty state and its two actions', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const onSeed = vi.fn()

    render(
      <Dashboard
        state={makeAppState()}
        onAdd={onAdd}
        onSeed={onSeed}
        onRenew={vi.fn()}
      />,
    )

    expect(screen.getByText('还没有记录任何会员')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '添加第一个会员' }))
    expect(onAdd).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: '载入示例数据' }))
    expect(onSeed).toHaveBeenCalledTimes(1)
  })
})
