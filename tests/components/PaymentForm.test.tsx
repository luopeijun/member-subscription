// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/api'
import { PaymentForm } from '@/components/PaymentForm/PaymentForm'
import type { AppState, Subscription } from '@/types'
import { makeAppState, makeSubscription } from '../fixtures'

vi.mock('@/api', () => ({ api: vi.fn() }))

const apiMock = vi.mocked(api)

function makeActiveSubscription(
  overrides: Partial<Subscription> = {},
): Subscription {
  return makeSubscription({
    nextRenewalAt: '2026-11-01',
    daysLeft: 11,
    lastPayment: { id: 1, paidAt: '2026-10-01', amount: 1000 },
    ...overrides,
  })
}

function renderForm(subscription = makeActiveSubscription()) {
  const state = makeAppState({ subscriptions: [subscription] })
  const onClose = vi.fn()
  const onSaved = vi.fn()

  render(
    <PaymentForm
      state={state}
      subscription={subscription}
      onClose={onClose}
      onSaved={onSaved}
    />,
  )

  return { state, onClose, onSaved }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('PaymentForm', () => {
  it('prefills the last payment and converts duration to the next renewal date', () => {
    renderForm()

    expect(screen.getByText('记一笔续费')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(10)

    fireEvent.change(
      screen.getByPlaceholderText('未填写时按套餐计费周期'),
      { target: { value: '30' } },
    )

    expect(screen.getByDisplayValue('2026-12-01')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('2026-12-01'), {
      target: { value: '2026-12-15' },
    })

    expect(screen.getByPlaceholderText('未填写时按套餐计费周期')).toHaveValue(44)
  })

  it('fills the duration from a preset button', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: '1 个月' }))

    expect(screen.getByPlaceholderText('未填写时按套餐计费周期')).toHaveValue(30)
    expect(screen.getByDisplayValue('2026-12-01')).toBeInTheDocument()
  })

  it('submits the payment in fen and reports the saved state', async () => {
    const user = userEvent.setup()
    const { state, onSaved } = renderForm()
    const nextState: AppState = makeAppState({
      subscriptions: [makeActiveSubscription()],
    })
    apiMock.mockResolvedValue(nextState as never)

    fireEvent.change(
      screen.getByPlaceholderText('未填写时按套餐计费周期'),
      { target: { value: '30' } },
    )
    await user.type(
      screen.getByPlaceholderText('选填，例如本次有优惠券、平台代付'),
      '优惠',
    )
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/subscriptions/1/payments', {
        method: 'POST',
        body: JSON.stringify({
          paidAt: '2026-10-21',
          amount: 1000,
          durationDays: 30,
          note: '优惠',
        }),
      })
    })
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(nextState, '支付记录已添加')
    })
    expect(state.today).toBe('2026-10-21')
  })

  it('uses the planned purchase wording and success message', async () => {
    const user = userEvent.setup()
    const planned = makeSubscription({
      status: 'planned',
      lastPayment: null,
      nextRenewalAt: null,
      daysLeft: null,
      listPrice: 1500,
    })
    const { onSaved } = renderForm(planned)
    apiMock.mockResolvedValue(makeAppState() as never)

    expect(screen.getByText('记一笔购买')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(15)

    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.anything(),
        '已记录购买，会员转为活跃',
      )
    })
  })

  it('validates the amount before calling the API', async () => {
    const user = userEvent.setup()
    renderForm()

    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '' },
    })
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(screen.getByText('请填写支付金额')).toBeInTheDocument()
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('shows an API error without closing the form', async () => {
    const user = userEvent.setup()
    const { onClose } = renderForm()
    apiMock.mockRejectedValue(new Error('网络错误'))

    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(await screen.findByText('网络错误')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const { onClose } = renderForm()

    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
