// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FlowTabs } from '@/components/FlowTabs/FlowTabs'

afterEach(cleanup)

describe('FlowTabs', () => {
  it('marks the active tab and reports changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <FlowTabs
        value="joint"
        onChange={onChange}
        ariaLabel="比价类型"
        tabs={[
          { value: 'joint', label: '联合报价', count: 3 },
          { value: 'members', label: '会员', count: 5 },
        ]}
      />,
    )

    expect(screen.getByRole('tablist', { name: '比价类型' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /联合报价/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: /会员/ })).toHaveAttribute(
      'aria-selected',
      'false',
    )

    await user.click(screen.getByRole('tab', { name: /会员/ }))
    expect(onChange).toHaveBeenCalledWith('members')
  })

  it('shows the count for every tab', () => {
    render(
      <FlowTabs
        value="joint"
        onChange={vi.fn()}
        ariaLabel="比价类型"
        tabs={[
          { value: 'joint', label: '联合报价', count: 3 },
          { value: 'members', label: '会员', count: 5 },
        ]}
      />,
    )

    expect(screen.getByRole('tab', { name: /联合报价/ })).toHaveTextContent(
      '联合报价3',
    )
    expect(screen.getByRole('tab', { name: /会员/ })).toHaveTextContent('会员5')
  })
})
