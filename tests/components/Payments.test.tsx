// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Payments } from '@/pages/Payments/Payments'
import type { JointRenewal, Payment } from '@/types'
import {
  makeAppState,
  makeJointRenewal,
  makeJointRenewalMember,
  makePayment,
} from '../fixtures'

afterEach(cleanup)

type RenderOptions = {
  payments?: Payment[]
  jointRenewals?: JointRenewal[]
}

function renderPayments({
  payments = [],
  jointRenewals = [],
}: RenderOptions = {}) {
  const onDelete = vi.fn()
  const onDeleteJointRenewal = vi.fn()

  const result = render(
    <Payments
      state={makeAppState({ payments, jointRenewals })}
      onDelete={onDelete}
      onDeleteJointRenewal={onDeleteJointRenewal}
    />,
  )

  return { ...result, onDelete, onDeleteJointRenewal }
}

function makeMonthlyPayments(count: number): Payment[] {
  return Array.from({ length: count }, (_, index) => {
    const month = String(index + 1).padStart(2, '0')
    return makePayment({
      id: index + 1,
      serviceName: `服务 ${month}`,
      paidAt: `2026-${month}-01`,
    })
  })
}

function makeManyRenewals(count: number): JointRenewal[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, '0')
    return makeJointRenewal({
      id: index + 1,
      mainServiceName: `平台 ${number}`,
      paidAt: '2026-10-01',
      members: [
        makeJointRenewalMember({
          subscriptionId: index + 1,
          serviceName: `平台 ${number}`,
        }),
      ],
    })
  })
}

describe('Payments', () => {
  it('shows the overall empty state when there are no records', () => {
    renderPayments()

    expect(screen.getByText('还没有支付流水')).toBeInTheDocument()
    expect(
      screen.getByText(
        '在会员页续费后，支付流水会出现在这里，可以查看涨价和实际月均成本。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '清除筛选' }),
    ).not.toBeInTheDocument()
  })

  it('renders individual payments with totals and deletes the selected payment', async () => {
    const user = userEvent.setup()
    const payments = [
      makePayment({
        id: 1,
        serviceName: 'Netflix',
        planName: 'Premium',
        paidAt: '2026-10-01',
        amount: 8800,
        note: '年付',
      }),
      makePayment({
        id: 2,
        serviceName: 'Spotify',
        planName: 'Standard',
        paidAt: '2026-10-02',
        amount: 1200,
      }),
      makePayment({
        id: 3,
        serviceName: 'Netflix 联合',
        planName: 'Premium',
        paidAt: '2026-10-03',
        amount: 5000,
        jointRenewalId: 99,
      }),
    ]

    const { container, onDelete } = renderPayments({ payments })
    const rows = container.querySelectorAll('.pay-row')

    expect(rows).toHaveLength(2)
    expect(screen.queryByText('Netflix 联合')).not.toBeInTheDocument()
    expect(container.querySelector('.inline-stats')).toHaveTextContent(
      '共 2 笔',
    )
    expect(container.querySelector('.inline-stats')).toHaveTextContent(
      '合计 ¥100.00',
    )
    expect(container.querySelector('.inline-stats')).toHaveTextContent(
      '单笔均值 ¥50.00',
    )

    expect(rows[0]).toHaveTextContent('2026-10-01')
    expect(rows[0]).toHaveTextContent('Netflix')
    expect(rows[0]).toHaveTextContent('Premium')
    expect(rows[0]).toHaveTextContent('¥88.00')
    expect(rows[0]).toHaveTextContent('年付')
    expect(rows[1]).toHaveTextContent('Spotify')
    expect(rows[1]).toHaveTextContent('¥12.00')
    expect(rows[1]).toHaveTextContent('—')

    await user.click(
      within(rows[1] as HTMLElement).getByRole('button', { name: '删除' }),
    )

    expect(onDelete).toHaveBeenCalledWith(payments[1])
  })

  it('filters individual payments by service, plan, and clearable search', async () => {
    const user = userEvent.setup()
    const payments = [
      makePayment({
        id: 1,
        serviceName: 'Netflix',
        planName: 'Premium',
        amount: 8800,
      }),
      makePayment({
        id: 2,
        serviceName: 'Spotify',
        planName: 'Standard',
        amount: 1200,
        paidAt: '2026-10-02',
      }),
    ]

    const { container } = renderPayments({ payments })
    const rows = () => container.querySelectorAll('.pay-row')
    const input = screen.getByLabelText('搜索会员名称')

    await user.type(input, 'netflix')

    expect(rows()).toHaveLength(1)
    expect(container.querySelector('.pay-row')).toHaveTextContent('Netflix')
    expect(container.querySelector('.inline-stats')).toHaveTextContent(
      '共 1 笔',
    )

    await user.click(screen.getByRole('button', { name: '清除搜索' }))

    expect(rows()).toHaveLength(2)
    expect(input).toHaveValue('')

    await user.type(input, 'premium')

    expect(rows()).toHaveLength(1)
    expect(container.querySelector('.pay-row')).toHaveTextContent('Premium')

    await user.clear(input)
    await user.type(input, 'missing')

    expect(rows()).toHaveLength(0)
    expect(screen.getByText('没有找到普通续费记录')).toBeInTheDocument()
    expect(
      screen.getByText(
        '会员名称里没有包含「missing」的普通续费记录。',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清除筛选' }))

    expect(rows()).toHaveLength(2)
    expect(input).toHaveValue('')
  })

  it('filters by a date range, handles reversed dates, and clears the range', async () => {
    const user = userEvent.setup()
    const payments = makeMonthlyPayments(12)
    const { container } = renderPayments({ payments })
    const rows = () => container.querySelectorAll('.pay-row')
    const fromDate = screen.getByLabelText('开始日期')
    const toDate = screen.getByLabelText('结束日期')

    expect(rows()).toHaveLength(10)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )

    fireEvent.change(fromDate, { target: { value: '2026-03-01' } })

    expect(rows()).toHaveLength(10)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 1 页',
    )

    fireEvent.change(toDate, { target: { value: '2026-06-01' } })

    expect(rows()).toHaveLength(4)
    expect(container.querySelector('.inline-stats')).toHaveTextContent(
      '共 4 笔',
    )

    fireEvent.change(fromDate, { target: { value: '2026-07-01' } })

    expect(selector(container, '.date-range')).toHaveClass('invalid')
    expect(selector(container, '.date-range')).toHaveAttribute(
      'title',
      '开始日期不能晚于结束日期',
    )
    expect(rows()).toHaveLength(0)
    expect(screen.getByText('没有找到普通续费记录')).toBeInTheDocument()
    expect(
      screen.getByText('开始日期不能晚于结束日期。'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清除筛选' }))

    expect(rows()).toHaveLength(10)
    expect(fromDate).toHaveValue('')
    expect(toDate).toHaveValue('')
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )

    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )

    fireEvent.change(fromDate, { target: { value: '2026-01-01' } })

    expect(rows()).toHaveLength(10)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )

    fireEvent.change(toDate, { target: { value: '2026-12-31' } })
    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )

    await user.click(
      screen.getByRole('button', { name: '清除日期筛选' }),
    )

    expect(rows()).toHaveLength(10)
    expect(fromDate).toHaveValue('')
    expect(toDate).toHaveValue('')
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )
    expect(
      screen.queryByRole('button', { name: '清除日期筛选' }),
    ).not.toBeInTheDocument()

    fireEvent.change(fromDate, { target: { value: '2027-01-01' } })

    expect(rows()).toHaveLength(0)
    expect(
      screen.getByText('所选日期范围内没有普通续费记录。'),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText('搜索会员名称'), 'missing')

    expect(
      screen.getByText('当前搜索和日期范围内没有普通续费记录。'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /联合续费/ }))

    expect(
      screen.getByText('当前搜索和日期范围内没有联合续费记录。'),
    ).toBeInTheDocument()

    await user.clear(screen.getByLabelText('搜索会员名称'))

    expect(
      screen.getByText('所选日期范围内没有联合续费记录。'),
    ).toBeInTheDocument()
  })

  it('switches to joint renewals and renders cards with delete handling', async () => {
    const user = userEvent.setup()
    const jointRenewals = [
      makeJointRenewal({
        id: 1,
        paidAt: '2026-10-05',
        total: 10000,
        costMode: 'split',
        note: '一起买',
        mainServiceName: 'Netflix',
        members: [
          makeJointRenewalMember({
            subscriptionId: 1,
            serviceName: 'Netflix',
            planName: 'Premium',
            amount: 5000,
            durationDays: 365,
          }),
          makeJointRenewalMember({
            subscriptionId: 2,
            serviceName: 'Spotify',
            planName: 'Individual',
            amount: 5000,
            durationDays: 365,
          }),
        ],
      }),
      makeJointRenewal({
        id: 2,
        paidAt: '2026-10-06',
        total: 5000,
        costMode: 'main',
        mainSubscriptionId: null,
        mainServiceName: null,
        members: [
          makeJointRenewalMember({
            subscriptionId: 3,
            serviceName: 'YouTube',
            planName: 'Premium',
            amount: 5000,
            durationDays: 30,
          }),
        ],
      }),
    ]

    const { container, onDeleteJointRenewal } = renderPayments({
      payments: [makePayment()],
      jointRenewals,
    })

    await user.click(screen.getByRole('tab', { name: /联合续费/ }))

    const cards = () => container.querySelectorAll('.joint-renewal-card')
    const stats = container.querySelector('.inline-stats')

    expect(cards()).toHaveLength(2)
    expect(stats).toHaveTextContent('共 2 条')
    expect(stats).toHaveTextContent('合计 ¥150.00')
    expect(stats).toHaveTextContent('单条均值 ¥75.00')

    const first = cards()[0] as HTMLElement
    const second = cards()[1] as HTMLElement
    const firstMembers = first.querySelectorAll('.joint-renewal-member')

    expect(first).toHaveTextContent('2026年10月5日 · 2 个会员')
    expect(first).toHaveTextContent('合计 ¥100.00')
    expect(within(first).getByText('均分')).toBeInTheDocument()
    expect(firstMembers).toHaveLength(2)
    expect(firstMembers[0]).toHaveTextContent('Netflix')
    expect(firstMembers[0]).toHaveTextContent('365 天 · ¥50.00')
    expect(firstMembers[1]).toHaveTextContent('Spotify')
    expect(first).toHaveTextContent('费用归属：Netflix · 均分 · 一起买')

    expect(second).toHaveTextContent('2026年10月6日 · 1 个会员')
    expect(within(second).getByText('主会员承担')).toBeInTheDocument()
    expect(second).toHaveTextContent('30 天 · ¥50.00')
    expect(second).toHaveTextContent(
      '费用归属：已删除会员 · 主会员承担',
    )

    await user.click(
      within(second).getByRole('button', { name: '删除记录' }),
    )

    expect(onDeleteJointRenewal).toHaveBeenCalledWith(jointRenewals[1])

    fireEvent.change(screen.getByLabelText('开始日期'), {
      target: { value: '2026-10-06' },
    })

    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toHaveTextContent('2026年10月6日')
    expect(stats).toHaveTextContent('共 1 条')

    await user.click(
      screen.getByRole('button', { name: '清除日期筛选' }),
    )

    expect(cards()).toHaveLength(2)
  })

  it('filters joint renewals by main service, member, plan, and note', async () => {
    const user = userEvent.setup()
    const jointRenewals = [
      makeJointRenewal({
        id: 1,
        mainServiceName: 'Netflix',
        note: 'family plan',
        members: [
          makeJointRenewalMember({
            subscriptionId: 1,
            serviceName: 'Netflix',
            planName: 'Premium',
          }),
          makeJointRenewalMember({
            subscriptionId: 2,
            serviceName: 'Spotify',
            planName: 'Individual',
          }),
        ],
      }),
      makeJointRenewal({
        id: 2,
        mainServiceName: 'YouTube',
        members: [
          makeJointRenewalMember({
            subscriptionId: 3,
            serviceName: 'YouTube',
            planName: 'Premium',
          }),
        ],
      }),
    ]

    const { container } = renderPayments({
      payments: [makePayment()],
      jointRenewals,
    })

    await user.click(screen.getByRole('tab', { name: /联合续费/ }))

    const cards = () => container.querySelectorAll('.joint-renewal-card')
    const input = screen.getByLabelText('搜索会员名称')

    await user.type(input, 'family')

    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toHaveTextContent('Netflix')

    await user.clear(input)
    await user.type(input, 'spotify')

    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toHaveTextContent('Spotify')

    await user.clear(input)
    await user.type(input, 'individual')

    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toHaveTextContent('Netflix')

    await user.clear(input)
    await user.type(input, 'youtube')

    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toHaveTextContent('YouTube')

    await user.clear(input)
    await user.type(input, 'missing')

    expect(cards()).toHaveLength(0)
    expect(screen.getByText('没有找到联合续费记录')).toBeInTheDocument()
    expect(
      screen.getByText(
        '会员名称里没有包含「missing」的联合续费记录。',
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清除筛选' }))

    expect(cards()).toHaveLength(2)
    expect(input).toHaveValue('')
  })

  it('shows flow-specific empty states when only one kind of record exists', async () => {
    const user = userEvent.setup()
    const paymentsOnly = renderPayments({ payments: [makePayment()] })

    await user.click(screen.getByRole('tab', { name: /联合续费/ }))

    expect(screen.getByText('还没有联合续费记录')).toBeInTheDocument()
    expect(
      screen.getByText(
        '在会员页使用「联合续费」后，整条购买记录会出现在这里。',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '清除筛选' }),
    ).not.toBeInTheDocument()

    paymentsOnly.unmount()

    renderPayments({ jointRenewals: [makeJointRenewal()] })

    expect(screen.getByText('还没有普通续费记录')).toBeInTheDocument()
    expect(
      screen.getByText(
        '在会员卡片上记录续费后，普通续费流水会出现在这里。',
      ),
    ).toBeInTheDocument()
  })

  it('keeps pagination independent per tab and changes page size', async () => {
    const user = userEvent.setup()
    const { container } = renderPayments({
      payments: makeMonthlyPayments(11),
      jointRenewals: makeManyRenewals(11),
    })
    const paymentRows = () => container.querySelectorAll('.pay-row')
    const jointCards = () =>
      container.querySelectorAll('.joint-renewal-card')

    expect(paymentRows()).toHaveLength(10)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )

    await user.click(screen.getByRole('button', { name: '下一页' }))

    expect(paymentRows()).toHaveLength(1)
    expect(container.querySelector('.pay-row')).toHaveTextContent('服务 11')
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )

    await user.click(screen.getByRole('tab', { name: /联合续费/ }))

    expect(jointCards()).toHaveLength(10)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )

    await user.click(screen.getByRole('button', { name: '下一页' }))

    expect(jointCards()).toHaveLength(1)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )

    await user.click(screen.getByRole('tab', { name: /普通续费/ }))

    expect(paymentRows()).toHaveLength(1)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )

    await user.click(screen.getByRole('button', { name: '每页条数' }))
    await user.click(screen.getByRole('option', { name: '20 条' }))

    expect(paymentRows()).toHaveLength(11)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 1 页',
    )

    await user.click(screen.getByRole('tab', { name: /联合续费/ }))

    expect(jointCards()).toHaveLength(1)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )

    await user.click(screen.getByRole('button', { name: '每页条数' }))
    await user.click(screen.getByRole('option', { name: '20 条' }))

    expect(jointCards()).toHaveLength(11)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 1 页',
    )
  })

  it('returns to the first page when the search changes', async () => {
    const user = userEvent.setup()
    const { container } = renderPayments({
      payments: makeMonthlyPayments(11),
    })

    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )

    await user.type(screen.getByLabelText('搜索会员名称'), '服务')

    expect(container.querySelectorAll('.pay-row')).toHaveLength(10)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )
  })
})

function selector(container: HTMLElement, value: string): Element {
  const element = container.querySelector(value)
  if (!element) throw new Error(`Missing element: ${value}`)
  return element
}
