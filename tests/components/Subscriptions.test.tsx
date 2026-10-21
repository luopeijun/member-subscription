// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Subscriptions } from '@/pages/Subscriptions/Subscriptions'
import { makeAppState, makeSubscription } from '../fixtures'

afterEach(cleanup)

function renderSubscriptions() {
  const subscriptions = Array.from({ length: 10 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0')
    return makeSubscription({
      id: index + 1,
      serviceName: `服务 ${number}`,
      status: 'active',
      nextRenewalAt: '2026-11-01',
      daysLeft: 11,
    })
  })
  const state = makeAppState({ subscriptions })

  const { container } = render(
    <Subscriptions
      state={state}
      onAdd={vi.fn()}
      onJointRenew={vi.fn()}
      onEdit={vi.fn()}
      onRenew={vi.fn()}
      onDelete={vi.fn()}
    />,
  )

  return { container }
}

describe('Subscriptions', () => {
  it('uses a fixed page size of 9 and hides the page-size selector', async () => {
    const user = userEvent.setup()
    const { container } = renderSubscriptions()

    expect(container.querySelectorAll('.sub-card')).toHaveLength(9)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )
    expect(
      screen.queryByRole('button', { name: '每页条数' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下一页' }))

    expect(container.querySelectorAll('.sub-card')).toHaveLength(1)
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )
  })

  it('returns to the first page when the status filter changes', async () => {
    const user = userEvent.setup()
    const { container } = renderSubscriptions()

    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 2 页',
    )

    await user.click(screen.getByRole('button', { name: /活跃/ }))

    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 1 / 2 页',
    )
    expect(container.querySelectorAll('.sub-card')).toHaveLength(9)
  })
})
