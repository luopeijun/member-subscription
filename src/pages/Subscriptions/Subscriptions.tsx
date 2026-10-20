import { useMemo, useState } from 'react'
import type { AppState, Subscription } from '@/types'
import { EmptyState } from '@/components/EmptyState/EmptyState'
import { SearchBox } from '@/components/SearchBox/SearchBox'
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
  const [query, setQuery] = useState('')

  const keyword = query.trim().toLowerCase()

  const list = useMemo(() => {
    const filtered = state.subscriptions.filter((sub) => {
      if (filter !== 'all' && sub.status !== filter) return false
      return subscriptionMatchesQuery(sub, keyword)
    })

    return [...filtered].sort(sortSubscriptions)
  }, [state.subscriptions, filter, keyword])

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="chips">
          {FILTERS.map((item) => {
            const count =
              item.value === 'all'
                ? state.subscriptions.length
                : state.subscriptions.filter((sub) => sub.status === item.value).length
            return (
              <button
                key={item.value}
                className={`chip ${filter === item.value ? 'active' : ''}`}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span>{count}</span>
              </button>
            )
          })}
        </div>
        <div className="toolbar-right">
          <SearchBox
            value={query}
            onChange={setQuery}
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
                : filter === 'all'
                  ? '还没有会员记录'
                  : '这个状态下没有记录'
            }
            description={
              keyword
                ? `名称、平台或备注里没有包含「${query.trim()}」的记录。`
                : filter === 'all'
                  ? '添加会员时顺手记录一次实际支付，后续每次续费再补一笔，统计就会自动滚起来。'
                  : '切换筛选条件看看。'
            }
            action={
              keyword ? (
                <button className="btn" onClick={() => setQuery('')}>
                  清除搜索
                </button>
              ) : filter === 'all' ? (
                <button className="btn primary" onClick={onAdd}>
                  添加会员
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="sub-grid">
          {list.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              onEdit={onEdit}
              onRenew={onRenew}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
