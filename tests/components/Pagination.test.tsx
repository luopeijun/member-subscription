// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Pagination } from '@/components/Pagination/Pagination'

afterEach(cleanup)

describe('Pagination', () => {
  it('moves between pages and reports the requested page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()

    const { container } = render(
      <Pagination
        page={2}
        pageSize={10}
        total={35}
        onPageChange={onPageChange}
      />,
    )

    expect(screen.getByText('35')).toBeInTheDocument()
    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 2 / 4 页',
    )

    await user.click(screen.getByRole('button', { name: '下一页' }))
    expect(onPageChange).toHaveBeenLastCalledWith(3)

    await user.click(screen.getByRole('button', { name: '上一页' }))
    expect(onPageChange).toHaveBeenLastCalledWith(1)

    await user.click(screen.getByRole('button', { name: '末页' }))
    expect(onPageChange).toHaveBeenLastCalledWith(4)

    await user.click(screen.getByRole('button', { name: '首页' }))
    expect(onPageChange).toHaveBeenLastCalledWith(1)
  })

  it('disables edge buttons on the first and last page', () => {
    const { rerender } = render(
      <Pagination page={1} pageSize={10} total={20} onPageChange={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: '首页' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '下一页' })).toBeEnabled()

    rerender(
      <Pagination page={2} pageSize={10} total={20} onPageChange={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '末页' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '上一页' })).toBeEnabled()
  })

  it('clamps an out-of-range page to the last page', () => {
    const { container } = render(
      <Pagination page={99} pageSize={10} total={35} onPageChange={vi.fn()} />,
    )

    expect(container.querySelector('.pager-current')).toHaveTextContent(
      '第 4 / 4 页',
    )
    expect(screen.getByRole('button', { name: '末页' })).toBeDisabled()
  })

  it('changes page size and returns to the first page', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    const onPageSizeChange = vi.fn()

    render(
      <Pagination
        page={3}
        pageSize={10}
        total={35}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: '每页条数' }))
    await user.click(screen.getByRole('option', { name: '20 条' }))

    expect(onPageSizeChange).toHaveBeenCalledWith(20)
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('renders nothing when there are no records', () => {
    const { container } = render(
      <Pagination page={1} pageSize={10} total={0} onPageChange={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('hides the page-size selector when disabled', () => {
    render(
      <Pagination
        page={1}
        pageSize={9}
        total={10}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        showPageSize={false}
      />,
    )

    expect(
      screen.queryByRole('button', { name: '每页条数' }),
    ).not.toBeInTheDocument()
  })
})
