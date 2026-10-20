import { useMemo, useState } from 'react'
import type {
  AppState,
  JointQuote,
  Plan,
  Snapshot,
  Subscription,
} from '@/types'
import { formatCNY } from '@shared/money'
import { DAYS_PER_MONTH, formatDuration } from '@shared/duration'
import { EmptyState } from '@/components/EmptyState/EmptyState'
import { SearchBox } from '@/components/SearchBox/SearchBox'
import { cycleLabel, equivalentMonthly } from '@/utils/cycle'
import { formatDay } from '@/utils/format'
import { groupPlansByService } from '@/utils/plan'
import { latestPerPlatform, searchSnapshots } from '@/utils/snapshot'
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

function JointQuoteCard({
  quote,
  onDelete,
}: {
  quote: JointQuote
  onDelete: (jointQuote: JointQuote) => void
}) {
  const entries = quote.items.map((item) => {
    const currentCost =
      item.monthly !== null && item.durationDays > 0
        ? Math.round((item.monthly * item.durationDays) / DAYS_PER_MONTH)
        : null
    return { item, currentCost }
  })
  const currentTotal = entries.reduce((sum, entry) => sum + (entry.currentCost ?? 0), 0)
  const excluded = entries.filter((entry) => entry.currentCost === null).length
  const diff = quote.items.length > 0 ? quote.total - currentTotal : null

  return (
    <article className="joint-quote-card">
      <div className="joint-quote-head">
        <div>
          <strong>
            {quote.platform ?? '未标注'} · {formatDay(quote.capturedAt)}
          </strong>
          <span>
            {quote.items.length} 个会员 · 总价 {formatCNY(quote.total)}
          </span>
        </div>
        <button className="btn sm danger" onClick={() => onDelete(quote)}>
          删除
        </button>
      </div>

      <div className="joint-quote-items">
        {quote.items.length === 0 ? (
          <span className="muted">关联会员已删除</span>
        ) : (
          quote.items.map((item) => (
            <span className="joint-quote-item" key={item.subscriptionId}>
              {item.serviceName}
              <em>
                {formatDuration(item.durationDays)}
                {item.monthly === null ? '' : ` · 当前 ${formatCNY(item.monthly)}/月`}
              </em>
            </span>
          ))
        )}
      </div>

      <div className="joint-quote-compare">
        <div className="quote-compare-cell">
          <span>当前组合总价</span>
          <strong>{formatCNY(currentTotal)}</strong>
        </div>
        <div className="quote-compare-cell">
          <span>捆绑包总价</span>
          <strong>{formatCNY(quote.total)}</strong>
        </div>
        <div className="quote-compare-cell">
          <span>差额</span>
          {diff === null ? (
            <span className="muted">—</span>
          ) : diff < 0 ? (
            <span className="badge ok">省 {formatCNY(-diff)}</span>
          ) : diff > 0 ? (
            <span className="badge warn">贵 {formatCNY(diff)}</span>
          ) : (
            <span className="badge muted">持平</span>
          )}
        </div>
      </div>

      {excluded > 0 ? (
        <p className="joint-hint">
          有 {excluded} 个会员没有可比的月均成本，未计入对比。
        </p>
      ) : null}
      {quote.note ? <p className="joint-hint">{quote.note}</p> : null}
    </article>
  )
}

function ComparePlan({
  plan,
  state,
  onSnapshot,
  onDeletePlan,
  onDeleteSnapshot,
}: {
  plan: Plan
  state: AppState
  onSnapshot: (plan: Plan) => void
  onDeletePlan: (plan: Plan) => void
  onDeleteSnapshot: (snapshot: Snapshot) => void
}) {
  const mySub: Subscription | undefined = state.subscriptions.find(
    (sub) => sub.planId === plan.id && sub.status === 'active',
  )
  const myMonthly = mySub?.lastPayment
    ? equivalentMonthly(plan.cycleMonths, mySub.lastPayment.amount)
    : null
  const offers = latestPerPlatform(state.snapshots, plan.id)
  const monthlyOffers = offers
    .map((offer) => equivalentMonthly(offer.cycleMonths, offer.price))
    .filter((value): value is number => value !== null)
  const lowestMonthly = monthlyOffers.length > 0 ? Math.min(...monthlyOffers) : null

  return (
    <div className="plan-block">
      <div className="plan-head">
        <div>
          <h3>
            {plan.name}
            {plan.subscribed ? <span className="badge ok">我在用</span> : null}
          </h3>
          <p>
            {cycleLabel(plan.cycleMonths)}
            {plan.listPrice > 0 ? ` · 标价 ${formatCNY(plan.listPrice)}` : ' · 未填标价'}
            {plan.note ? ` · ${plan.note}` : ''}
          </p>
        </div>
        <div className="row gap-6">
          <button className="btn sm" onClick={() => onSnapshot(plan)}>
            记录平台报价
          </button>
          {!plan.subscribed ? (
            <button className="btn sm danger" onClick={() => onDeletePlan(plan)}>
              删除套餐
            </button>
          ) : null}
        </div>
      </div>

      {mySub ? (
        <div className="my-purchase">
          <span className="my-tag">我的购买</span>
          <strong>{mySub.platform ?? '平台未记录'}</strong>
          <span className="my-price">
            {mySub.lastPayment ? formatCNY(mySub.lastPayment.amount) : '未记录支付'}
            <small> / {cycleLabel(plan.cycleMonths)}</small>
          </span>
          {myMonthly !== null ? (
            <span className="my-monthly">≈ {formatCNY(myMonthly)}/月</span>
          ) : null}
          {mySub.lastPayment ? (
            <span className="my-date">最近支付 {formatDay(mySub.lastPayment.paidAt)}</span>
          ) : null}
        </div>
      ) : (
        <div className="my-purchase empty-my">我没有买这个套餐，下面是我看过的报价。</div>
      )}

      {offers.length === 0 ? (
        <p className="offer-empty muted">
          还没有录入其他平台的价格。点「记录平台报价」把看到的价格和购买方式记下来。
        </p>
      ) : (
        <div className="offer-list">
          <div className="offer-row offer-head">
            <span>平台</span>
            <span>报价</span>
            <span>等效月成本</span>
            <span>对比我的</span>
            <span>记录日期</span>
            <span>怎么买</span>
            <span />
          </div>
          {offers.map((offer) => {
            const monthly = equivalentMonthly(offer.cycleMonths, offer.price)
            const diff =
              monthly !== null && myMonthly !== null ? monthly - myMonthly : null
            const isCurrent =
              Boolean(mySub?.platform) &&
              (offer.platform ?? '').trim().toLowerCase() ===
                (mySub?.platform ?? '').trim().toLowerCase()
            const isLowest = monthly !== null && monthly === lowestMonthly

            return (
              <div
                className={`offer-row ${isLowest ? 'lowest' : ''}`}
                key={offer.id}
              >
                <span className="offer-platform">
                  {offer.platform ?? '未标注'}
                  {isCurrent ? <span className="badge info">当前</span> : null}
                  {isLowest ? <span className="badge ok">最低</span> : null}
                </span>
                <span className="offer-price">
                  {formatCNY(offer.price)}
                  <small> / {cycleLabel(offer.cycleMonths)}</small>
                </span>
                <span className="offer-monthly">
                  {monthly !== null ? `${formatCNY(monthly)}/月` : '—'}
                </span>
                <span>
                  {diff === null ? (
                    <span className="muted">—</span>
                  ) : diff < 0 ? (
                    <span className="badge ok">省 {formatCNY(-diff)}/月</span>
                  ) : diff > 0 ? (
                    <span className="badge warn">贵 {formatCNY(diff)}/月</span>
                  ) : (
                    <span className="badge muted">持平</span>
                  )}
                </span>
                <span className="offer-date">{formatDay(offer.capturedAt)}</span>
                <span className="offer-note">{offer.note ?? '—'}</span>
                <button
                  className="btn sm danger offer-delete"
                  onClick={() => onDeleteSnapshot(offer)}
                >
                  删除
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
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
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="搜索会员名称"
          />
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
        下面是我录入的其他平台报价。差价按<strong>等效月成本</strong>计算（年付 ÷ 12），
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
                  state={state}
                  onSnapshot={onSnapshot}
                  onDeletePlan={onDeletePlan}
                  onDeleteSnapshot={onDeleteSnapshot}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {history.length > 0 ? (
        <section className="card card-pad">
          <div className="card-head">
            <div>
              <h2>全部报价记录</h2>
              <p>同一个平台只展示最新一条在主视图，这里可以查看和清理历史</p>
            </div>
          </div>
          <div className="history-list">
            {history.map((snapshot) => (
              <div className="history-row" key={snapshot.id}>
                <span className="history-date">{formatDay(snapshot.capturedAt)}</span>
                <span className="history-platform">{snapshot.platform ?? '未标注'}</span>
                <div className="history-main">
                  <strong>
                    {snapshot.serviceName} · {snapshot.planName}
                  </strong>
                  <span>{snapshot.note ?? '—'}</span>
                </div>
                <span className="history-price">{formatCNY(snapshot.price)}</span>
                <button
                  className="btn sm danger"
                  onClick={() => onDeleteSnapshot(snapshot)}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
