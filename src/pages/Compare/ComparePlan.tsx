import type { Plan, Snapshot, Subscription } from '@/types'
import type { MemberJointQuoteEntry } from '@/utils/jointQuote'
import { formatCNY } from '@shared/money'
import { cycleLabel, cycleMonthly } from '@/utils/cycle'
import { formatDay } from '@/utils/format'
import { latestPerPlatform, snapshotMonthly } from '@/utils/snapshot'
import { OfferRow } from './OfferRow'
import { PlanJointQuote } from './PlanJointQuote'
import './ComparePlan.scss'

type ComparePlanProps = {
  plan: Plan
  subscriptions: Subscription[]
  snapshots: Snapshot[]
  jointQuoteEntries: Map<number, MemberJointQuoteEntry[]>
  onSnapshot: (plan: Plan) => void
  onDeletePlan: (plan: Plan) => void
  onDeleteSnapshot: (snapshot: Snapshot) => void
  onEditSnapshot: (snapshot: Snapshot) => void
}

export function ComparePlan({
  plan,
  subscriptions,
  snapshots,
  jointQuoteEntries,
  onSnapshot,
  onDeletePlan,
  onDeleteSnapshot,
  onEditSnapshot,
}: ComparePlanProps) {
  const mySub = subscriptions.find(
    (sub) => sub.planId === plan.id && sub.status === 'active',
  )
  const memberJointQuotes = mySub ? (jointQuoteEntries.get(mySub.id) ?? []) : []
  const myMonthly = mySub?.lastPayment
    ? cycleMonthly(plan.cycleMonths, plan.cycleDays, mySub.lastPayment.amount)
    : null
  const offers = latestPerPlatform(snapshots, plan.id)
  const monthlyOffers = offers
    .map((offer) => snapshotMonthly(offer))
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
            {cycleLabel(plan.cycleMonths, plan.cycleDays)}
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
            <small> / {cycleLabel(plan.cycleMonths, plan.cycleDays)}</small>
          </span>
          {myMonthly !== null ? (
            <span className="my-monthly">≈ {formatCNY(myMonthly)}/月</span>
          ) : null}
          {mySub.lastPayment ? (
            <span className="my-date">最近支付 {formatDay(mySub.lastPayment.paidAt)}</span>
          ) : null}
        </div>
      ) : (
        <div className="my-purchase empty-my">当前未购买该套餐，以下为已录入的平台报价。</div>
      )}

      {memberJointQuotes.length > 0 ? (
        <PlanJointQuote entries={memberJointQuotes} />
      ) : null}

      {offers.length === 0 ? (
        <p className="offer-empty muted">
          还没有录入其他平台报价。点击「记录平台报价」录入平台价格与购买方式。
        </p>
      ) : (
        <div className="offer-list">
          <div className="offer-row offer-head">
            <span>平台</span>
            <span>报价</span>
            <span>等效月成本</span>
            <span>对比我的</span>
            <span>记录日期</span>
            <span>总时长</span>
            <span>购买方式 / 备注</span>
            <span />
          </div>
          {offers.map((offer) => (
            <OfferRow
              key={offer.id}
              offer={offer}
              myMonthly={myMonthly}
              myPlatform={mySub?.platform ?? undefined}
              lowestMonthly={lowestMonthly}
              onEdit={onEditSnapshot}
              onDelete={onDeleteSnapshot}
            />
          ))}
        </div>
      )}
    </div>
  )
}
