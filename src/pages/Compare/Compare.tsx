import { useMemo, useState } from 'react'
import type { AppState, JointQuote, Plan, Snapshot } from '@/types'
import { EmptyState } from '@/components/EmptyState/EmptyState'
import { FlowTabs } from '@/components/FlowTabs/FlowTabs'
import { Pagination } from '@/components/Pagination/Pagination'
import { SearchBox } from '@/components/SearchBox/SearchBox'
import { buildMemberJointQuoteEntries } from '@/utils/jointQuote'
import { groupPlansByService } from '@/utils/plan'
import { ComparePlan } from './ComparePlan'
import { JointQuoteCard } from './JointQuoteCard'
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

type CompareTab = 'joint' | 'members'

function jointQuoteMatches(quote: JointQuote, keyword: string): boolean {
  if (!keyword) return true
  const haystack = [
    quote.platform,
    quote.note,
    ...quote.items.map((item) => item.serviceName),
    ...quote.items.map((item) => item.planName),
  ]
  return haystack.some(
    (value) => Boolean(value && value.toLowerCase().includes(keyword)),
  )
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
  const [compareTab, setCompareTab] = useState<CompareTab>('joint')
  const [jointPage, setJointPage] = useState(1)
  const [jointPageSize, setJointPageSize] = useState(10)
  const [memberPage, setMemberPage] = useState(1)
  const [memberPageSize, setMemberPageSize] = useState(10)
  const keyword = query.trim().toLowerCase()

  const groups = useMemo(
    () => groupPlansByService(state.plans, keyword),
    [state.plans, keyword],
  )

  const jointQuotes = useMemo(
    () => state.jointQuotes.filter((quote) => jointQuoteMatches(quote, keyword)),
    [state.jointQuotes, keyword],
  )

  const jointQuoteEntries = useMemo(
    () => buildMemberJointQuoteEntries(state.jointQuotes),
    [state.jointQuotes],
  )

  const jointTotalPages = Math.max(1, Math.ceil(jointQuotes.length / jointPageSize))
  const currentJointPage = Math.min(jointPage, jointTotalPages)
  const jointPageItems = jointQuotes.slice(
    (currentJointPage - 1) * jointPageSize,
    currentJointPage * jointPageSize,
  )

  const memberTotalPages = Math.max(1, Math.ceil(groups.length / memberPageSize))
  const currentMemberPage = Math.min(memberPage, memberTotalPages)
  const memberPageItems = groups.slice(
    (currentMemberPage - 1) * memberPageSize,
    currentMemberPage * memberPageSize,
  )

  const changeQuery = (value: string) => {
    setQuery(value)
    setJointPage(1)
    setMemberPage(1)
  }

  const clearSearch = () => changeQuery('')
  const hasFilters = Boolean(keyword)
  const hasAnything = state.plans.length > 0 || state.jointQuotes.length > 0

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
          <SearchBox value={query} onChange={changeQuery} placeholder="搜索会员名称" />
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

      {!hasAnything ? (
        <div className="card card-pad">
          <EmptyState
            title="还没有可比较的套餐"
            description="点击「记录平台报价」录入同一服务的不同套餐或价格档位，保存后可对比不同平台的等效月成本。"
            action={
              <button className="btn primary" onClick={onNewQuote}>
                记录平台报价
              </button>
            }
          />
        </div>
      ) : (
        <>
          <FlowTabs
            value={compareTab}
            onChange={setCompareTab}
            ariaLabel="比价类型"
            tabs={[
              { value: 'joint', label: '联合报价', count: jointQuotes.length },
              { value: 'members', label: '会员', count: groups.length },
            ]}
          />

          {compareTab === 'joint' ? (
            jointQuotes.length === 0 ? (
              <div className="card card-pad">
                <EmptyState
                  title={hasFilters ? '没有找到联合报价' : '还没有联合报价'}
                  description={
                    hasFilters
                      ? `联合报价里没有包含「${query.trim()}」的会员、套餐或平台。`
                      : '一次购买多个会员时，可以记录联合报价，按分摊后的等效月成本对比。'
                  }
                  action={
                    hasFilters ? (
                      <button className="btn" onClick={clearSearch}>
                        清除搜索
                      </button>
                    ) : (
                      <button className="btn primary" onClick={onAddJointQuote}>
                        记录联合报价
                      </button>
                    )
                  }
                />
              </div>
            ) : (
              <>
                <div className="card card-pad">
                  <div className="joint-quote-list">
                    {jointPageItems.map((quote) => (
                      <JointQuoteCard
                        key={quote.id}
                        quote={quote}
                        onEdit={onEditJointQuote}
                        onDelete={onDeleteJointQuote}
                      />
                    ))}
                  </div>
                </div>
                <Pagination
                  page={currentJointPage}
                  pageSize={jointPageSize}
                  total={jointQuotes.length}
                  onPageChange={setJointPage}
                  onPageSizeChange={setJointPageSize}
                />
              </>
            )
          ) : groups.length === 0 ? (
            <div className="card card-pad">
              <EmptyState
                title={hasFilters ? '没有找到匹配的会员' : '还没有可比较的会员'}
                description={
                  hasFilters
                    ? `会员名称或套餐名称里没有包含「${query.trim()}」。`
                    : '点击「记录平台报价」录入套餐后，这里会显示每个会员的比价。'
                }
                action={
                  hasFilters ? (
                    <button className="btn" onClick={clearSearch}>
                      清除搜索
                    </button>
                  ) : (
                    <button className="btn primary" onClick={onNewQuote}>
                      记录平台报价
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <>
              {memberPageItems.map((group) => (
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
              ))}
              <Pagination
                page={currentMemberPage}
                pageSize={memberPageSize}
                total={groups.length}
                onPageChange={setMemberPage}
                onPageSizeChange={setMemberPageSize}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
