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
import { JointRenewForm } from '@/components/JointRenewForm/JointRenewForm'
import type { AppState, Subscription } from '@/types'
import { makeAppState, makeSubscription } from '../fixtures'

vi.mock('@/api', () => ({ api: vi.fn() }))

const apiMock = vi.mocked(api)

function makeSub(id: number, serviceName: string, annualized: number): Subscription {
  return makeSubscription({
    id,
    planId: id,
    serviceName,
    planName: '标准版',
    annualized,
    lastPayment: { id, paidAt: '2026-10-01', amount: 1000 },
    nextRenewalAt: '2026-11-01',
    daysLeft: 11,
  })
}

function renderForm() {
  const state = makeAppState({
    subscriptions: [
      makeSub(1, '服务 A', 12000),
      makeSub(2, '服务 B', 24000),
    ],
  })
  const onClose = vi.fn()
  const onSaved = vi.fn()

  render(
    <JointRenewForm state={state} onClose={onClose} onSaved={onSaved} />,
  )

  return { state, onClose, onSaved }
}

async function addMember(
  user: ReturnType<typeof userEvent.setup>,
  serviceName: string,
) {
  await user.click(
    screen.getByRole('combobox', { name: '选择要添加的会员' }),
  )
  await user.type(
    screen.getByRole('combobox', { name: '选择要添加的会员' }),
    serviceName,
  )
  await user.click(screen.getByRole('option', { name: new RegExp(serviceName) }))
  await user.click(screen.getByRole('button', { name: '添加' }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('JointRenewForm', () => {
  it('adds members, previews split costs, and requires at least two members', async () => {
    const user = userEvent.setup()
    renderForm()

    await addMember(user, '服务 A')
    await addMember(user, '服务 B')
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '120' },
    })

    const dialog = screen.getByRole('dialog')
    const costs = dialog.querySelectorAll('.joint-member-cost')
    expect(costs).toHaveLength(2)
    expect(costs[0]).toHaveTextContent('¥60.00')
    expect(costs[1]).toHaveTextContent('¥60.00')
    expect(dialog.querySelector('.joint-summary')).toHaveTextContent(
      '本次共 2 个会员，合计 ¥120.00 · 按天数分摊，余数记在服务 A',
    )
    expect(screen.getByRole('button', { name: '记录联合续费' })).toBeEnabled()

    await user.click(screen.getAllByRole('button', { name: '移除' })[0])

    expect(screen.getByRole('button', { name: '记录联合续费' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: '移除' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '移除' }))

    expect(
      screen.getByText('还没有添加会员。至少添加两个才能记录联合续费。'),
    ).toBeInTheDocument()
  })

  it('assigns the full total to the main member in main mode', async () => {
    const user = userEvent.setup()
    renderForm()

    await addMember(user, '服务 A')
    await addMember(user, '服务 B')
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '120' },
    })
    await user.selectOptions(
      screen.getByDisplayValue('均分（按天数）'),
      'main',
    )

    const dialog = screen.getByRole('dialog')
    const costs = dialog.querySelectorAll('.joint-member-cost')
    expect(costs[0]).toHaveTextContent('¥120.00')
    expect(costs[1]).toHaveTextContent('¥0.00')
    expect(dialog.querySelector('.joint-summary')).toHaveTextContent(
      '本次共 2 个会员，合计 ¥120.00 · 全部记在服务 A',
    )
  })

  it('submits a joint renewal with member durations and total in fen', async () => {
    const user = userEvent.setup()
    const { state, onSaved } = renderForm()
    const nextState: AppState = makeAppState()
    apiMock.mockResolvedValue(nextState as never)

    await addMember(user, '服务 A')
    await addMember(user, '服务 B')
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '120' },
    })
    await user.type(
      screen.getByPlaceholderText('选填，例如平台优惠、代付说明'),
      '联合续费',
    )
    await user.click(screen.getByRole('button', { name: '记录联合续费' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/joint-renewals', {
        method: 'POST',
        body: JSON.stringify({
          members: [
            { subscriptionId: 1, durationDays: 365 },
            { subscriptionId: 2, durationDays: 365 },
          ],
          mainSubscriptionId: 1,
          total: 12000,
          paidAt: state.today,
          costMode: 'split',
          note: '联合续费',
        }),
      })
    })
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(nextState, '联合续费已记录')
    })
  })

  it('validates the total before calling the API', async () => {
    const user = userEvent.setup()
    renderForm()

    await addMember(user, '服务 A')
    await addMember(user, '服务 B')
    await user.click(screen.getByRole('button', { name: '记录联合续费' }))

    expect(screen.getByText('请填写本次购买总金额')).toBeInTheDocument()
    expect(apiMock).not.toHaveBeenCalled()
  })

  it('applies the default duration to every member', async () => {
    const user = userEvent.setup()
    renderForm()

    await addMember(user, '服务 A')
    await addMember(user, '服务 B')
    fireEvent.change(screen.getByLabelText('默认天数'), {
      target: { value: '30' },
    })
    await user.click(screen.getByRole('button', { name: '应用到全部' }))

    expect(screen.getByLabelText('服务 A 时长（天）')).toHaveValue(30)
    expect(screen.getByLabelText('服务 B 时长（天）')).toHaveValue(30)
  })
})
