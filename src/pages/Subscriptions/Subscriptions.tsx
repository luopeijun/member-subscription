import { useMemo, useState } from 'react'
import type { AppState, Subscription } from '@/types'
import { CATEGORIES } from '@/constants'
import { EmptyState } from '@/components/EmptyState/EmptyState'
import { Pagination } from '@/components/Pagination/Pagination'
import { SearchBox } from '@/components/SearchBox/SearchBox'
import { SelectMenu } from '@/components/SelectMenu/SelectMenu'
import { sortSubscriptions, subscriptionMatchesQuery } from '@/utils/subscription'
import { SubscriptionCard } from './SubscriptionCard'
import './Subscriptions.scss'

type SubscriptionsProps = {
  state: AppState
  onAdd: () => void
  onJointRenew: () => void
  onEdit: (subscription: Subscription) => void
  onRenew: (subscription: Subscription) => void
  onDelete: (subscription: Subscription) => void
}

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '活跃' },
  { value: 'planned', label: '想买' },
  { value: 'expired', label: '已过期' },
] as const

type Filter = (typeof FILTERS)[number]['value']

export function Subscriptions({
  state,
  onAdd,
  onJointRenew,
  onEdit,
  onRenew,
  onDelete,
}: SubscriptionsProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const keyword = query.trim().toLowerCase()
  const PAGE_SIZE = 9

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const sub of state.subscriptions) {
      counts.set(sub.category, (counts.get(sub.category) ?? 0) + 1)
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const aIndex = CATEGORIES.indexOf(a.name)
        const bIndex = CATEGORIES.indexOf(b.name)
        if (aIndex === -1 && bIndex === -1) {
          return a.name.localeCompare(b.name, 'zh-CN')
        }
        if (aIndex === -1) return 1
        if (bIndex === -1) return -1
        return aIndex - bIndex
      })
  }, [state.subscriptions])

  const categoryScoped = useMemo(
    () =>
      category === 'all'
        ? state.subscriptions
        : state.subscriptions.filter((sub) => sub.category === category),
    [state.subscriptions, category],
  )

  const list = useMemo(() => {
    const filtered = categoryScoped.filter((sub) => {
      if (filter !== 'all' && sub.status !== filter) return false
      return subscriptionMatchesQuery(sub, keyword)
    })

    return [...filtered].sort(sortSubscriptions)
  }, [categoryScoped, filter, keyword])

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = list.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const changeFilter = (value: Filter) => {
    setFilter(value)
    setPage(1)
  }

  const changeCategory = (value: string) => {
    setCategory(value)
    setPage(1)
  }

  const changeQuery = (value: string) => {
    setQuery(value)
    setPage(1)
  }

  const hasFilter = filter !== 'all' || category !== 'all'
  const clearFilters = () => {
    setFilter('all')
    setCategory('all')
    setQuery('')
    setPage(1)
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="chips">
          {FILTERS.map((item) => {
            const count =
              item.value === 'all'
                ? categoryScoped.length
                : categoryScoped.filter((sub) => sub.status === item.value).length
            return (
              <button
                key={item.value}
                className={`chip ${filter === item.value ? 'active' : ''}`}
                onClick={() => changeFilter(item.value)}
              >
                {item.label}
                <span>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="toolbar-right">
          <SelectMenu
            value={category}
            onChange={changeCategory}
            ariaLabel="按类别筛选"
            options={[
              {
                value: 'all',
                label: '全部类别',
                meta: String(state.subscriptions.length),
              },
              ...categoryOptions.map((item) => ({
                value: item.name,
                label: item.name,
                meta: String(item.count),
              })),
            ]}
          />
          <SearchBox
            value={query}
            onChange={changeQuery}
            placeholder="搜索会员名称或备注"
          />
          <button className="btn" onClick={onJointRenew}>
            联合续费
          </button>
          <button className="btn primary" onClick={onAdd}>
            + 添加会员
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            title={
              keyword
                ? '没有找到匹配的会员'
                : filter !== 'all'
                  ? category !== 'all'
                    ? '当前类别下没有该状态的会员'
                    : '这个状态下没有记录'
                  : category !== 'all'
                    ? '这个类别下没有会员'
                    : '还没有会员记录'
            }
            description={
              keyword
                ? `名称、平台或备注里没有包含「${query.trim()}」的记录。`
                : filter !== 'all' || category !== 'all'
                  ? '换个类别或状态看看。'
                  : '添加会员时顺手记录一次实际支付，后续每次续费再补一笔，统计就会自动滚起来。'
            }
            action={
              keyword || hasFilter ? (
                <button className="btn" onClick={clearFilters}>
                  清除筛选
                </button>
              ) : (
                <button className="btn primary" onClick={onAdd}>
                  添加会员
                </button>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="sub-grid">
            {pageItems.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onEdit={onEdit}
                onRenew={onRenew}
                onDelete={onDelete}
              />
            ))}
          </div>
          <Pagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            total={list.length}
            onPageChange={setPage}
            showPageSize={false}
          />
        </>
      )}
    </div>
  )
}
