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
import { SubscriptionForm } from '@/components/SubscriptionForm/SubscriptionForm'
import type { AppState, Subscription } from '@/types'
import {
  makeAppState,
  makeService,
  makeSubscription,
} from '../fixtures'

vi.mock('@/api', () => ({ api: vi.fn() }))

const apiMock = vi.mocked(api)

function renderForm(editing?: Subscription, services = [makeService()]) {
  const state = makeAppState({ services })
  const onClose = vi.fn()
  const onSaved = vi.fn()

  render(
    <SubscriptionForm
      state={state}
      editing={editing}
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

describe('SubscriptionForm', () => {
  it('creates an active subscription with its first payment', async () => {
    const user = userEvent.setup()
    const { state, onSaved } = renderForm()
    const nextState: AppState = makeAppState()
    apiMock.mockResolvedValue(nextState as never)

    fireEvent.change(
      screen.getByPlaceholderText('Netflix / iCloud+ / ChatGPT'),
      { target: { value: 'Netflix' } },
    )
    fireEvent.change(screen.getByPlaceholderText('高级会员 / 200GB / Plus'), {
      target: { value: '高级会员' },
    })
    fireEvent.change(screen.getByPlaceholderText('用于比价基准'), {
      target: { value: '120' },
    })
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '99' },
    })
    await user.type(
      screen.getByPlaceholderText('选填，例如登录邮箱'),
      'family@example.com',
    )
    await user.type(screen.getByPlaceholderText('选填'), '家庭共享')

    await user.click(screen.getByRole('button', { name: '添加会员' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          serviceName: 'Netflix',
          category: '影音娱乐',
          planName: '高级会员',
          cycleMonths: 12,
          cycleDays: null,
          listPrice: 12000,
          platform: '官网',
          account: 'family@example.com',
          startedAt: state.today,
          nextRenewalOverride: null,
          autoRenew: false,
          status: 'active',
          note: '家庭共享',
          payment: {
            paidAt: state.today,
            amount: 9900,
            note: null,
          },
        }),
      })
    })
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(nextState, '会员已添加')
    })
  })

  it('creates a planned subscription without a payment', async () => {
    const user = userEvent.setup()
    const { state, onSaved } = renderForm()
    apiMock.mockResolvedValue(makeAppState() as never)

    fireEvent.change(
      screen.getByPlaceholderText('Netflix / iCloud+ / ChatGPT'),
      { target: { value: 'ChatGPT' } },
    )
    fireEvent.change(screen.getByPlaceholderText('高级会员 / 200GB / Plus'), {
      target: { value: 'Plus' },
    })
    await user.selectOptions(screen.getByDisplayValue('活跃'), 'planned')

    expect(screen.queryByPlaceholderText('0.00')).not.toBeInTheDocument()
    expect(screen.getByText(/想买状态先不记支付/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '添加会员' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          serviceName: 'ChatGPT',
          category: '影音娱乐',
          planName: 'Plus',
          cycleMonths: 12,
          cycleDays: null,
          listPrice: 0,
          platform: '官网',
          account: null,
          startedAt: state.today,
          nextRenewalOverride: null,
          autoRenew: false,
          status: 'planned',
          note: null,
        }),
      })
    })
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.anything(),
        '会员已添加',
      )
    })
  })

  it('validates the service, plan, and first payment before calling the API', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: '添加会员' }))
    expect(screen.getByText('请填写服务名称')).toBeInTheDocument()

    fireEvent.change(
      screen.getByPlaceholderText('Netflix / iCloud+ / ChatGPT'),
      { target: { value: 'Netflix' } },
    )
    await user.click(screen.getByRole('button', { name: '添加会员' }))
    expect(screen.getByText('请填写套餐名称')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('高级会员 / 200GB / Plus'), {
      target: { value: '高级会员' },
    })
    await user.click(screen.getByRole('button', { name: '添加会员' }))
    expect(screen.getByText('请填写本次支付金额')).toBeInTheDocument()
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('edits an existing subscription without sending a payment', async () => {
    const user = userEvent.setup()
    const editing = makeSubscription({
      serviceName: 'Netflix',
      planName: '标准版',
      platform: '官网',
      account: 'old@example.com',
      startedAt: '2026-01-01',
      autoRenew: true,
    })
    const { onSaved } = renderForm(editing)
    apiMock.mockResolvedValue(makeAppState() as never)

    expect(screen.getByText('编辑会员')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Netflix / iCloud+ / ChatGPT'),
    ).toBeDisabled()
    expect(
      screen.getByPlaceholderText('高级会员 / 200GB / Plus'),
    ).toHaveValue('标准版')
    expect(screen.getByPlaceholderText('用于比价基准')).toHaveValue(10)
    expect(screen.queryByPlaceholderText('0.00')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('高级会员 / 200GB / Plus'), {
      target: { value: '高级版' },
    })
    fireEvent.change(screen.getByPlaceholderText('用于比价基准'), {
      target: { value: '15' },
    })
    fireEvent.change(screen.getByPlaceholderText('选填'), {
      target: { value: '新备注' },
    })

    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/subscriptions/1', {
        method: 'PUT',
        body: JSON.stringify({
          category: '其他',
          planName: '高级版',
          cycleMonths: 1,
          cycleDays: null,
          listPrice: 1500,
          platform: '官网',
          account: 'old@example.com',
          startedAt: '2026-01-01',
          autoRenew: true,
          status: 'active',
          nextRenewalOverride: null,
          note: '新备注',
        }),
      })
    })
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.anything(),
        '已保存修改',
      )
    })
  })

  it('fills the category from an existing service name', () => {
    renderForm(undefined, [
      makeService({ id: 1, name: 'ChatGPT', category: 'AI 服务' }),
    ])

    fireEvent.change(
      screen.getByPlaceholderText('Netflix / iCloud+ / ChatGPT'),
      { target: { value: 'chatgpt' } },
    )

    expect(screen.getByDisplayValue('AI 服务')).toBeInTheDocument()
  })
})
