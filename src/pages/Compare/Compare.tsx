import { useMemo, useState } from 'react'
import type { AppState, JointQuote, Plan, Snapshot } from '@/types'
import { EmptyState } from '@/components/EmptyState/EmptyState'
import { SearchBox } from '@/components/SearchBox/SearchBox'
import { groupPlansByService } from '@/utils/plan'
import { searchSnapshots } from '@/utils/snapshot'
import { ComparePlan } from './ComparePlan'
import { JointQuoteCard } from './JointQuoteCard'
import { SnapshotHistory } from './SnapshotHistory'
import './Compare.scss'

type CompareProps = {
  state: AppState
  onAddPlan: () => void
  onSnapshot: (plan: Plan) => void
  onDeletePlan: (plan: Plan) => void
  onDeleteSnapshot: (snapshot: Snapshot) => void
  onAddJointQuote: () => void
  onDeleteJointQuote: (jointQuote: JointQuote) => void
}

export function Compare({
  state,
  onAddPlan,
  onSnapshot,
  onDeletePlan,
  onDeleteSnapshot,
  onAddJointQuote,
  onDeleteJointQuote,
}: CompareProps) {
  const [query, setQuery] = useState('')
  const keyword = query.trim().toLowerCase()

  const groups = useMemo(
    () => groupPlansByService(state.plans, keyword),
    [state.plans, keyword],
  )

  const history = useMemo(
    () => searchSnapshots(state.snapshots, keyword),
    [state.snapshots, keyword],
  )

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="inline-stats">
          <span>
            <strong>{state.plans.length}</strong> 个套餐 · 已录入{' '}
            <strong>{state.snapshots.length}</strong> 条平台报价
            {state.jointQuotes.length > 0 ? (
              <>
                {' '}
                · <strong>{state.jointQuotes.length}</strong> 条联合报价
              </>
            ) : null}
          </span>
        </div>
        <div className="toolbar-right">
          <SearchBox value={query} onChange={setQuery} placeholder="搜索会员名称" />
          <button className="btn" onClick={onAddJointQuote}>
            记录联合报价
          </button>
          <button className="btn primary" onClick={onAddPlan}>
            + 添加候选套餐
          </button>
        </div>
      </div>

      <p className="page-note">
        每个套餐下面，上面一行是<strong>你当前购买的平台和价格</strong>，
        下面是我录入的其他平台报价。差价按<strong>等效月成本</strong>计算（年付 ÷ 12）；
        如果报价填了会员到期日，就按记录日期到到期日的实际天数折算。
        合租、代充、需要额外条件的情况写在「怎么买」里。
        捆绑装则记成<strong>联合报价</strong>，按每个会员各自拿到的天数算出当前组合要花多少钱，
        再和捆绑包总价对比。
      </p>

      {state.jointQuotes.length > 0 ? (
        <section className="card card-pad">
          <div className="card-head">
            <div>
              <h2>联合报价</h2>
              <p>一次买多个会员的总价，对比同样时长下当前组合要花的钱</p>
            </div>
          </div>
          <div className="joint-quote-list">
            {state.jointQuotes.map((quote) => (
              <JointQuoteCard
                key={quote.id}
                quote={quote}
                onDelete={onDeleteJointQuote}
              />
            ))}
          </div>
        </section>
      ) : null}

      {groups.length === 0 ? (
        <div className="card card-pad">
          {keyword ? (
            <EmptyState
              title="没有找到匹配的套餐"
              description={`会员名称里没有包含「${query.trim()}」的套餐。`}
              action={
                <button className="btn" onClick={() => setQuery('')}>
                  清除搜索
                </button>
              }
            />
          ) : (
            <EmptyState
              title="还没有可比较的套餐"
              description="点「添加候选套餐」录入同一服务的不同套餐或不同价格档位，再记录每个平台的报价，就能看到换平台是否划算。"
              action={
                <button className="btn primary" onClick={onAddPlan}>
                  添加候选套餐
                </button>
              }
            />
          )}
        </div>
      ) : (
        groups.map((group) => (
          <section className="card compare-card" key={group.serviceName}>
            <div className="group-head">
              <div>
                <h2>{group.serviceName}</h2>
                <p>
                  {group.category} · {group.plans.length} 个套餐
                </p>
              </div>
            </div>
            <div className="plan-list">
              {group.plans.map((plan) => (
                <ComparePlan
                  key={plan.id}
                  plan={plan}
                  subscriptions={state.subscriptions}
                  snapshots={state.snapshots}
                  onSnapshot={onSnapshot}
                  onDeletePlan={onDeletePlan}
                  onDeleteSnapshot={onDeleteSnapshot}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <SnapshotHistory snapshots={history} onDelete={onDeleteSnapshot} />
    </div>
  )
}
