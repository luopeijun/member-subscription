// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Compare } from '@/pages/Compare/Compare'
import {
  makeAppState,
  makeJointQuote,
  makeJointQuoteItem,
  makePlan,
} from '../fixtures'

afterEach(cleanup)

function makeCompareState() {
  const plans = Array.from({ length: 11 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0')
    return makePlan({
      id: index + 1,
      serviceId: index + 1,
      serviceName: `服务 ${number}`,
      subscribed: false,
    })
  })

  const jointQuotes = Array.from({ length: 11 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0')
    return makeJointQuote({
      id: index + 1,
      platform: `平台 ${number}`,
      mainSubscriptionId: index + 1,
      items: [
        makeJointQuoteItem({
          subscriptionId: index + 1,
          serviceName: `服务 ${number}`,
        }),
      ],
    })
  })

  return makeAppState({ plans, jointQuotes })
}

function renderCompare() {
  const state = makeCompareState()
  const { container } = render(
    <Compare
      state={state}
      onNewQuote={vi.fn()}
      onSnapshot={vi.fn()}
      onDeletePlan={vi.fn()}
      onDeleteSnapshot={vi.fn()}
      onEditSnapshot={vi.fn()}
      onAddJointQuote={vi.fn()}
      onEditJointQuote={vi.fn()}
      onDeleteJointQuote={vi.fn()}
    />,
  )
  return { container }
}

describe('Compare', () => {
  it('shows joint quotes and members in separate tabs', () => {
    const { container } = renderCompare()

    expect(screen.getByRole('tab', { name: /联合报价/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: /会员/ })).toHaveAttribute(
      'aria-selected',
      'false',
    )
    expect(container.querySelectorAll('.joint-quote-card')).toHaveLength(10)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )
    expect(
      screen.queryByText('全部报价记录'),
    ).not.toBeInTheDocument()
  })

  it('keeps joint and member pagination independent', async () => {
    const user = userEvent.setup()
    const { container } = renderCompare()

    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(container.querySelectorAll('.joint-quote-card')).toHaveLength(1)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )

    await user.click(screen.getByRole('tab', { name: /会员/ }))
    expect(container.querySelectorAll('.compare-card')).toHaveLength(10)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )

    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(container.querySelectorAll('.compare-card')).toHaveLength(1)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )

    await user.click(screen.getByRole('tab', { name: /联合报价/ }))
    expect(container.querySelectorAll('.joint-quote-card')).toHaveLength(1)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )
  })

  it('uses 10 records per page in both tabs', () => {
    const { container } = renderCompare()

    expect(screen.getByRole('button', { name: '每页条数' })).toHaveTextContent(
      '10 条',
    )
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )
  })
})
