import { useMemo, useState } from 'react'
import type { AppState, JointQuote, Plan, Snapshot } from '@/types'
import { EmptyState } from '@/components/EmptyState/EmptyState'
import { SearchBox } from '@/components/SearchBox/SearchBox'
import { buildMemberJointQuoteEntries } from '@/utils/jointQuote'
import { groupPlansByService } from '@/utils/plan'
import { searchSnapshots } from '@/utils/snapshot'
import { ComparePlan } from './ComparePlan'
import { JointQuoteCard } from './JointQuoteCard'
import { SnapshotHistory } from './SnapshotHistory'
import './Compare.scss'

type CompareProps = {
  state: AppState
  onNewQuote: () => void
  onSnapshot: (plan: Plan) => void
  onDeletePlan: (plan: Plan) => void
  onDeleteSnapshot: (snapshot: Snapshot) => void
  onEditSnapshot: (snapshot: Snapshot) => void
  onAddJointQuote: () => void
  onEditJointQuote: (jointQuote: JointQuote) => void
  onDeleteJointQuote: (jointQuote: JointQuote) => void
}

export function Compare({
  state,
  onNewQuote,
  onSnapshot,
  onDeletePlan,
  onDeleteSnapshot,
  onEditSnapshot,
  onAddJointQuote,
  onEditJointQuote,
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

  const jointQuoteEntries = useMemo(
    () => buildMemberJointQuoteEntries(state.jointQuotes),
    [state.jointQuotes],
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
          <button className="btn primary" onClick={onNewQuote}>
            + 记录平台报价
          </button>
        </div>
      </div>

      <p className="page-note">
        每个套餐展示<strong>当前购买的平台与价格</strong>，以及已录入的其他平台报价。
        差价按<strong>等效月成本</strong>计算：年付按 12 个月折算；报价填写套餐总时长时，
        按总时长折算月成本。首次记录套餐时，点击右上角<strong>「记录平台报价」</strong>
        会同时创建套餐；后续在同一套餐上点击该按钮可继续追加报价。
        合租、代充、需要额外条件的情况，填写在「购买方式 / 备注」中。
        捆绑购买记录为<strong>联合报价</strong>，按各会员实际获得的时长计算当前组合成本，
        再与捆绑包总价对比。
      </p>

      {state.jointQuotes.length > 0 ? (
        <section className="card card-pad">
          <div className="card-head">
            <div>
              <h2>联合报价</h2>
              <p>一次购买多个会员的捆绑总价，与相同服务时长下的当前组合成本对比</p>
            </div>
          </div>
          <div className="joint-quote-list">
            {state.jointQuotes.map((quote) => (
              <JointQuoteCard
                key={quote.id}
                quote={quote}
                onEdit={onEditJointQuote}
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
              description="点击「记录平台报价」录入同一服务的不同套餐或价格档位，保存后可对比不同平台的等效月成本。"
              action={
                <button className="btn primary" onClick={onNewQuote}>
                  记录平台报价
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
                  jointQuoteEntries={jointQuoteEntries}
                  onSnapshot={onSnapshot}
                  onDeletePlan={onDeletePlan}
                  onDeleteSnapshot={onDeleteSnapshot}
                  onEditSnapshot={onEditSnapshot}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <SnapshotHistory
        snapshots={history}
        onEdit={onEditSnapshot}
        onDelete={onDeleteSnapshot}
      />
    </div>
  )
}
