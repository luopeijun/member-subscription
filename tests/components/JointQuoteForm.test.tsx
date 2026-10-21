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
import { JointQuoteForm } from '@/components/JointQuoteForm/JointQuoteForm'
import type { AppState, Subscription } from '@/types'
import {
  makeAppState,
  makeJointQuote,
  makeJointQuoteItem,
  makeSubscription,
} from '../fixtures'

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

function renderForm(editing = false) {
  const subscriptions = [
    makeSub(1, '服务 A', 12000),
    makeSub(2, '服务 B', 24000),
  ]
  const state = makeAppState({ subscriptions })
  const quote = editing
    ? makeJointQuote({
        id: 7,
        capturedAt: '2026-10-02',
        total: 12000,
        mainSubscriptionId: 1,
        platform: '拼车群',
        note: '旧备注',
        items: [
          makeJointQuoteItem({ subscriptionId: 1, serviceName: '服务 A' }),
          makeJointQuoteItem({ subscriptionId: 2, serviceName: '服务 B' }),
        ],
      })
    : undefined
  const onClose = vi.fn()
  const onSaved = vi.fn()

  render(
    <JointQuoteForm
      state={state}
      editing={quote}
      onClose={onClose}
      onSaved={onSaved}
    />,
  )

  return { state, onClose, onSaved, quote }
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

describe('JointQuoteForm', () => {
  it('adds members, previews split allocation, and disables submit below two members', async () => {
    const user = userEvent.setup()
    renderForm()

    await addMember(user, '服务 A')
    await addMember(user, '服务 B')
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '120' },
    })
    fireEvent.change(screen.getByPlaceholderText('淘宝 / 闲鱼 / 拼车群'), {
      target: { value: '拼车群' },
    })

    const dialog = screen.getByRole('dialog')
    const amounts = dialog.querySelectorAll('.joint-member-amounts strong')
    expect(amounts).toHaveLength(2)
    expect(amounts[0]).toHaveTextContent('分摊 ¥60.00')
    expect(amounts[1]).toHaveTextContent('分摊 ¥60.00')
    expect(dialog.querySelector('.badge.ok')).toHaveTextContent('省 ¥240.00')
    expect(screen.getByRole('button', { name: '记录报价' })).toBeEnabled()

    await user.click(screen.getAllByRole('button', { name: '移除' })[0])

    expect(screen.getByRole('button', { name: '记录报价' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: '移除' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '移除' }))

    expect(
      screen.getByText('还没有添加会员。至少添加两个才能记录联合报价。'),
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

    const amounts = screen
      .getByRole('dialog')
      .querySelectorAll('.joint-member-amounts strong')
    expect(amounts[0]).toHaveTextContent('分摊 ¥120.00')
    expect(amounts[1]).toHaveTextContent('分摊 ¥0.00')
    expect(screen.getByText('主会员承担 · 服务 A')).toBeInTheDocument()
  })

  it('submits a new quote in fen with the selected members', async () => {
    const user = userEvent.setup()
    const { state, onSaved } = renderForm()
    const nextState: AppState = makeAppState()
    apiMock.mockResolvedValue(nextState as never)

    await addMember(user, '服务 A')
    await addMember(user, '服务 B')
    fireEvent.change(screen.getByPlaceholderText('淘宝 / 闲鱼 / 拼车群'), {
      target: { value: '拼车群' },
    })
    fireEvent.change(screen.getByPlaceholderText('0.00'), {
      target: { value: '120' },
    })
    await user.type(
      screen.getByPlaceholderText('例如：代充；需要提供账号；含 4 个会员'),
      '联合报价',
    )
    await user.click(screen.getByRole('button', { name: '记录报价' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/joint-quotes', {
        method: 'POST',
        body: JSON.stringify({
          capturedAt: state.today,
          total: 12000,
          mainSubscriptionId: 1,
          costMode: 'split',
          platform: '拼车群',
          note: '联合报价',
          items: [
            { subscriptionId: 1, durationDays: 365 },
            { subscriptionId: 2, durationDays: 365 },
          ],
        }),
      })
    })
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(nextState, '联合报价已记录')
    })
  })

  it('edits an existing quote without showing the member picker', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderForm(true)
    apiMock.mockResolvedValue(makeAppState() as never)

    expect(screen.getByText('编辑联合报价')).toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: '选择要添加的会员' }),
    ).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(120)
    expect(screen.getByDisplayValue('拼车群')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/joint-quotes/7', {
        method: 'PUT',
        body: JSON.stringify({
          capturedAt: '2026-10-02',
          total: 12000,
          mainSubscriptionId: 1,
          costMode: 'split',
          platform: '拼车群',
          note: '旧备注',
          items: [
            { subscriptionId: 1, durationDays: 365 },
            { subscriptionId: 2, durationDays: 365 },
          ],
        }),
      })
    })
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.anything(), '联合报价已更新')
    })
  })
})
