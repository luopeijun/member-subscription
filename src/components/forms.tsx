import { useState, type FormEvent } from 'react'
import { api } from '../api'
import type { AppState, Plan, Subscription } from '../types'
import {
  CATEGORIES,
  CYCLE_OPTIONS,
  Modal,
  PLATFORM_SUGGESTIONS,
  STATUS_OPTIONS,
  cycleLabel,
} from './ui'
import { formatCNY, toMajor, toMinor } from '../../shared/money'
import { DAYS_PER_MONTH, DURATION_PRESETS } from '../../shared/duration'

type SavedHandler = (next: AppState, message: string) => void

function sectionTitle(text: string, hint?: string) {
  return (
    <div className="form-section-title">
      <span>{text}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  )
}

/* ---------------------------------- 会员表单 --------------------------------- */

type SubFormState = {
  serviceName: string
  category: string
  planName: string
  cycleMonths: number
  listPrice: string
  platform: string
  account: string
  startedAt: string
  autoRenew: boolean
  status: string
  nextRenewalOverride: string
  note: string
  paidAt: string
  amount: string
  paymentNote: string
}

type SubscriptionFormProps = {
  state: AppState
  editing?: Subscription
  onClose: () => void
  onSaved: SavedHandler
}

export function SubscriptionForm({ state, editing, onClose, onSaved }: SubscriptionFormProps) {
  const [form, setForm] = useState<SubFormState>(() => {
    if (editing) {
      return {
        serviceName: editing.serviceName,
        category: editing.category,
        planName: editing.planName,
        cycleMonths: editing.cycleMonths,
        listPrice: editing.listPrice ? String(toMajor(editing.listPrice)) : '',
        platform: editing.platform ?? '',
        account: editing.account ?? '',
        startedAt: editing.startedAt,
        autoRenew: editing.autoRenew,
        status: editing.status,
        nextRenewalOverride: editing.nextRenewalOverride ?? '',
        note: editing.note ?? '',
        paidAt: state.today,
        amount: '',
        paymentNote: '',
      }
    }
    return {
      serviceName: '',
      category: '影音娱乐',
      planName: '',
      cycleMonths: 12,
      listPrice: '',
      platform: '官网',
      account: '',
      startedAt: state.today,
      autoRenew: false,
      status: 'active',
      nextRenewalOverride: '',
      note: '',
      paidAt: state.today,
      amount: '',
      paymentNote: '',
    }
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const patch = (value: Partial<SubFormState>) => {
    setForm((current) => ({ ...current, ...value }))
  }

  const changeService = (name: string) => {
    const known = state.services.find(
      (service) => service.name.toLowerCase() === name.trim().toLowerCase(),
    )
    patch({ serviceName: name, category: known?.category ?? form.category })
  }

  const planned = form.status === 'planned'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!form.serviceName.trim()) {
      setError('请填写服务名称')
      return
    }
    if (!form.planName.trim()) {
      setError('请填写套餐名称')
      return
    }

    const listPriceNumber = Number(form.listPrice || 0)
    if (!Number.isFinite(listPriceNumber) || listPriceNumber < 0) {
      setError('标价格式不正确')
      return
    }

    if (!editing && !planned) {
      const amountNumber = Number(form.amount)
      if (form.amount === '' || !Number.isFinite(amountNumber) || amountNumber < 0) {
        setError('请填写本次支付金额')
        return
      }
    }

    setBusy(true)
    try {
      let next: AppState

      if (editing) {
        next = await api<AppState>(`/subscriptions/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            category: form.category,
            planName: form.planName.trim(),
            cycleMonths: form.cycleMonths,
            listPrice: toMinor(listPriceNumber),
            platform: form.platform.trim() || null,
            account: form.account.trim() || null,
            startedAt: form.startedAt,
            autoRenew: form.autoRenew,
            status: form.status,
            nextRenewalOverride: form.nextRenewalOverride || null,
            note: form.note.trim() || null,
          }),
        })
      } else {
        next = await api<AppState>('/subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            serviceName: form.serviceName.trim(),
            category: form.category,
            planName: form.planName.trim(),
            cycleMonths: form.cycleMonths,
            listPrice: toMinor(listPriceNumber),
            platform: form.platform.trim() || null,
            account: form.account.trim() || null,
            startedAt: form.startedAt,
            nextRenewalOverride: form.nextRenewalOverride || null,
            autoRenew: form.autoRenew,
            status: form.status,
            note: form.note.trim() || null,
            ...(planned
              ? {}
              : {
                  payment: {
                    paidAt: form.paidAt,
                    amount: toMinor(Number(form.amount)),
                    note: form.paymentNote.trim() || null,
                  },
                }),
          }),
        })
      }

      onSaved(next, editing ? '已保存修改' : '会员已添加')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={editing ? '编辑会员' : '添加会员'}
      subtitle={
        editing
          ? `${editing.serviceName} · ${editing.planName}`
          : '记录会员；想买但还没买的也可以先记下来'
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {sectionTitle('服务与套餐')}
        <div className="form-grid">
          <div className="field">
            <label>服务名称 *</label>
            <input
              list="known-services"
              value={form.serviceName}
              disabled={Boolean(editing)}
              placeholder="Netflix / iCloud+ / ChatGPT"
              onChange={(event) => changeService(event.target.value)}
            />
            <datalist id="known-services">
              {state.services.map((service) => (
                <option key={service.id} value={service.name} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>类别</label>
            <select value={form.category} onChange={(event) => patch({ category: event.target.value })}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>套餐名称 *</label>
            <input
              value={form.planName}
              placeholder="高级会员 / 200GB / Plus"
              onChange={(event) => patch({ planName: event.target.value })}
            />
          </div>
          <div className="field">
            <label>计费周期</label>
            <select
              value={form.cycleMonths}
              onChange={(event) => patch({ cycleMonths: Number(event.target.value) })}
            >
              {CYCLE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {sectionTitle('价格与支付', '所有金额按人民币记账')}
        <div className="form-grid">
          <div className="field">
            <label>标价（元，选填）</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.listPrice}
              placeholder="用于比价基准"
              onChange={(event) => patch({ listPrice: event.target.value })}
            />
          </div>
          {!editing && !planned ? (
            <>
              <div className="field">
                <label>本次支付金额（元）*</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  placeholder="0.00"
                  onChange={(event) => patch({ amount: event.target.value })}
                />
              </div>
              <div className="field">
                <label>支付日期</label>
                <input
                  type="date"
                  value={form.paidAt}
                  onChange={(event) => patch({ paidAt: event.target.value })}
                />
              </div>
              <div className="field">
                <label>支付备注</label>
                <input
                  value={form.paymentNote}
                  placeholder="选填，例如：优惠券、涨价"
                  onChange={(event) => patch({ paymentNote: event.target.value })}
                />
              </div>
            </>
          ) : null}
        </div>

        {!editing && planned ? (
          <p className="form-hint">
            想买状态先不记支付；之后在会员卡片点「记一笔购买」，记录支付后会自动转为活跃。
          </p>
        ) : null}

        {sectionTitle('订阅信息')}
        <div className="form-grid">
          <div className="field">
            <label>购买平台</label>
            <input
              list="platform-options"
              value={form.platform}
              placeholder="官网 / 淘宝 / 闲鱼 / 拼车群"
              onChange={(event) => patch({ platform: event.target.value })}
            />
            <datalist id="platform-options">
              {PLATFORM_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>账号 / 标识</label>
            <input
              value={form.account}
              placeholder="选填，例如登录邮箱"
              onChange={(event) => patch({ account: event.target.value })}
            />
          </div>
          <div className="field">
            <label>开始日期</label>
            <input
              type="date"
              value={form.startedAt}
              onChange={(event) => patch({ startedAt: event.target.value })}
            />
          </div>
          <div className="field">
            <label>状态</label>
            <select value={form.status} onChange={(event) => patch({ status: event.target.value })}>
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {!planned ? (
            <div className="field">
              <label>下次续费日（选填覆盖）</label>
              <input
                type="date"
                value={form.nextRenewalOverride}
                onChange={(event) => patch({ nextRenewalOverride: event.target.value })}
              />
            </div>
          ) : null}
          {!planned ? (
            <div className="field">
              <label>自动续费</label>
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={form.autoRenew}
                  onChange={(event) => patch({ autoRenew: event.target.checked })}
                />
                <span>到期自动扣款</span>
              </label>
            </div>
          ) : null}
          <div className="field">
            <label>备注</label>
            <input
              value={form.note}
              placeholder="选填"
              onChange={(event) => patch({ note: event.target.value })}
            />
          </div>
        </div>

        {editing ? (
          <p className="form-hint">修改计费周期会重新计算月均成本；历史支付金额不会被改写。</p>
        ) : null}

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? '保存中…' : editing ? '保存修改' : '添加会员'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------------------------- 支付表单 --------------------------------- */

type PaymentFormProps = {
  state: AppState
  subscription?: Subscription
  onClose: () => void
  onSaved: SavedHandler
}

export function PaymentForm({ state, subscription, onClose, onSaved }: PaymentFormProps) {
  const initialSub = subscription ?? state.subscriptions[0]
  const [subId, setSubId] = useState<number>(initialSub?.id ?? 0)
  const [amount, setAmount] = useState(() => {
    if (!initialSub) return ''
    if (initialSub.lastPayment) return String(toMajor(initialSub.lastPayment.amount))
    return initialSub.listPrice ? String(toMajor(initialSub.listPrice)) : ''
  })
  const [paidAt, setPaidAt] = useState(state.today)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selectSubscription = (id: number) => {
    setSubId(id)
    const target = state.subscriptions.find((item) => item.id === id)
    if (!target) return
    if (target.lastPayment) {
      setAmount(String(toMajor(target.lastPayment.amount)))
    } else if (target.listPrice) {
      setAmount(String(toMajor(target.listPrice)))
    } else {
      setAmount('')
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const amountNumber = Number(amount)
    if (!subId) {
      setError('请选择会员')
      return
    }
    if (amount === '' || !Number.isFinite(amountNumber) || amountNumber < 0) {
      setError('请填写支付金额')
      return
    }

    setBusy(true)
    try {
      const next = await api<AppState>(`/subscriptions/${subId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          paidAt,
          amount: toMinor(amountNumber),
          note: note.trim() || null,
        }),
      })
      const target = state.subscriptions.find((item) => item.id === subId)
      onSaved(next, target?.status === 'planned' ? '已记录购买，会员转为活跃' : '支付记录已添加')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={
        subscription
          ? subscription.status === 'planned'
            ? '记一笔购买'
            : '记录续费'
          : '记一笔支付'
      }
      subtitle={
        subscription
          ? subscription.status === 'planned'
            ? `${subscription.serviceName} · ${subscription.planName} · 记下后转为活跃`
            : `${subscription.serviceName} · ${subscription.planName}`
          : '选择会员并填写这次的实际支付'
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {!subscription ? (
          <div className="field" style={{ marginBottom: 14 }}>
            <label>会员</label>
            <select value={subId} onChange={(event) => selectSubscription(Number(event.target.value))}>
              {state.subscriptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.serviceName} · {item.planName}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="form-grid">
          <div className="field">
            <label>支付金额（元）*</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              placeholder="0.00"
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="field">
            <label>支付日期</label>
            <input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
          </div>
          <div className="field span-2">
            <label>备注</label>
            <input
              value={note}
              placeholder="选填，例如本次有优惠券、平台代付"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------------------------- 平台报价 --------------------------------- */

type SnapshotFormProps = {
  plan: Plan
  today: string
  onClose: () => void
  onSaved: SavedHandler
}

export function SnapshotForm({ plan, today, onClose, onSaved }: SnapshotFormProps) {
  const [price, setPrice] = useState(() =>
    plan.listPrice ? String(toMajor(plan.listPrice)) : '',
  )
  const [platform, setPlatform] = useState('')
  const [cycleMonths, setCycleMonths] = useState(plan.cycleMonths)
  const [capturedAt, setCapturedAt] = useState(today)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const priceNumber = Number(price)
    if (price === '' || !Number.isFinite(priceNumber) || priceNumber < 0) {
      setError('请填写价格')
      return
    }
    if (!platform.trim()) {
      setError('请填写平台名称')
      return
    }
    setBusy(true)
    try {
      const next = await api<AppState>('/snapshots', {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.id,
          capturedAt,
          price: toMinor(priceNumber),
          cycleMonths,
          platform: platform.trim(),
          note: note.trim() || null,
        }),
      })
      onSaved(next, '平台报价已记录')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="记录平台报价"
      subtitle={`${plan.serviceName} · ${plan.name} · ${cycleLabel(plan.cycleMonths)}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label>平台 *</label>
            <input
              list="quote-platforms"
              value={platform}
              placeholder="官网 / 淘宝 / 闲鱼 / 拼车群"
              onChange={(event) => setPlatform(event.target.value)}
            />
            <datalist id="quote-platforms">
              {PLATFORM_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>价格（元）*</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              placeholder="0.00"
              onChange={(event) => setPrice(event.target.value)}
            />
          </div>
          <div className="field">
            <label>计费周期 *</label>
            <select
              value={cycleMonths}
              onChange={(event) => setCycleMonths(Number(event.target.value))}
            >
              {CYCLE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>看到价格的日期</label>
            <input
              type="date"
              value={capturedAt}
              onChange={(event) => setCapturedAt(event.target.value)}
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>怎么买 / 备注</label>
          <input
            value={note}
            placeholder="例如：代充，需要提供账号；合租 3 人车位；新用户首月价"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? '保存中…' : '保存报价'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------------------------- 候选套餐 --------------------------------- */

type PlanFormProps = {
  state: AppState
  onClose: () => void
  onSaved: SavedHandler
}

export function PlanForm({ state, onClose, onSaved }: PlanFormProps) {
  const [serviceName, setServiceName] = useState('')
  const [category, setCategory] = useState('影音娱乐')
  const [planName, setPlanName] = useState('')
  const [cycleMonths, setCycleMonths] = useState(12)
  const [listPrice, setListPrice] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!serviceName.trim()) {
      setError('请填写服务名称')
      return
    }
    if (!planName.trim()) {
      setError('请填写套餐名称')
      return
    }
    const priceNumber = Number(listPrice || 0)
    if (!Number.isFinite(priceNumber) || priceNumber < 0) {
      setError('标价格式不正确')
      return
    }

    setBusy(true)
    try {
      const next = await api<AppState>('/plans', {
        method: 'POST',
        body: JSON.stringify({
          serviceName: serviceName.trim(),
          category,
          planName: planName.trim(),
          cycleMonths,
          listPrice: toMinor(priceNumber),
          note: note.trim() || null,
        }),
      })
      onSaved(next, '候选套餐已添加')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="添加候选套餐"
      subtitle="只用于比价，不会计入你的订阅支出"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label>服务名称 *</label>
            <input
              list="known-services-plan"
              value={serviceName}
              placeholder="Netflix / Spotify"
              onChange={(event) => {
                const name = event.target.value
                setServiceName(name)
                const known = state.services.find(
                  (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
                )
                if (known) setCategory(known.category)
              }}
            />
            <datalist id="known-services-plan">
              {state.services.map((service) => (
                <option key={service.id} value={service.name} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>类别</label>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>套餐名称 *</label>
            <input
              value={planName}
              placeholder="高级会员 / 家庭组"
              onChange={(event) => setPlanName(event.target.value)}
            />
          </div>
          <div className="field">
            <label>计费周期</label>
            <select
              value={cycleMonths}
              onChange={(event) => setCycleMonths(Number(event.target.value))}
            >
              {CYCLE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>标价（元，选填）</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={listPrice}
              placeholder="0.00"
              onChange={(event) => setListPrice(event.target.value)}
            />
          </div>
          <div className="field">
            <label>备注</label>
            <input
              value={note}
              placeholder="选填，例如共享人数、包含内容"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? '保存中…' : '添加套餐'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------------------------------- 联合报价 --------------------------------- */

type JointQuoteFormProps = {
  state: AppState
  onClose: () => void
  onSaved: SavedHandler
}

type QuoteItemDraft = {
  id: number
  days: number
}

function clampDays(value: string): number {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed)) return 1
  return Math.min(3650, Math.max(1, parsed))
}

function monthlyEquivalent(sub: Subscription): number | null {
  if (!sub.lastPayment || sub.annualized <= 0) return null
  return Math.round(sub.annualized / 12)
}

export function JointQuoteForm({ state, onClose, onSaved }: JointQuoteFormProps) {
  const [items, setItems] = useState<QuoteItemDraft[]>([])
  const [picker, setPicker] = useState('')
  const [platform, setPlatform] = useState('')
  const [total, setTotal] = useState('')
  const [defaultDays, setDefaultDays] = useState(365)
  const [capturedAt, setCapturedAt] = useState(state.today)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selected = items
    .map((draft) => {
      const sub = state.subscriptions.find((item) => item.id === draft.id)
      return sub ? { ...draft, sub } : null
    })
    .filter((item): item is QuoteItemDraft & { sub: Subscription } => Boolean(item))

  const options = [...state.subscriptions]
    .filter((sub) => !items.some((item) => item.id === sub.id))
    .sort((a, b) => a.serviceName.localeCompare(b.serviceName, 'zh-CN'))

  const totalFen =
    total === '' || !Number.isFinite(Number(total)) ? 0 : toMinor(Number(total))
  const entries = selected.map((item) => {
    const monthly = monthlyEquivalent(item.sub)
    const currentCost =
      monthly !== null && item.days > 0
        ? Math.round((monthly * item.days) / DAYS_PER_MONTH)
        : null
    return { ...item, monthly, currentCost }
  })
  const currentTotal = entries.reduce((sum, entry) => sum + (entry.currentCost ?? 0), 0)
  const excluded = entries.filter((entry) => entry.currentCost === null).length
  const diff = selected.length > 0 ? totalFen - currentTotal : null

  const addMember = () => {
    const id = Number(picker)
    if (!id) return
    setItems((current) => [...current, { id, days: defaultDays }])
    setPicker('')
    setError(null)
  }

  const removeMember = (id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }

  const updateItem = (id: number, days: number) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, days } : item)),
    )
  }

  const applyDefault = () => {
    setItems((current) => current.map((item) => ({ ...item, days: defaultDays })))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (selected.length < 2) {
      setError('联合报价至少选择两个会员')
      return
    }
    if (!platform.trim()) {
      setError('请填写平台名称')
      return
    }
    if (total === '' || !Number.isFinite(Number(total)) || Number(total) < 0) {
      setError('请填写捆绑包总价')
      return
    }

    setBusy(true)
    try {
      const next = await api<AppState>('/joint-quotes', {
        method: 'POST',
        body: JSON.stringify({
          capturedAt,
          total: totalFen,
          platform: platform.trim(),
          note: note.trim() || null,
          items: selected.map((item) => ({
            subscriptionId: item.id,
            durationDays: item.days,
          })),
        }),
      })
      onSaved(next, '联合报价已记录')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="记录联合报价"
      subtitle="一次买多个会员的总价，和同样时长下当前组合要花的钱对比"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="field">
          <label>这条报价包含哪些会员</label>
          <div className="joint-add-row">
            <select
              value={picker}
              onChange={(event) => setPicker(event.target.value)}
            >
              <option value="">选择要添加的会员</option>
              {options.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.serviceName} · {sub.planName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              onClick={addMember}
              disabled={!picker}
            >
              添加
            </button>
          </div>
          <p className="joint-hint">
            选择你现在持有的会员，再填每个会员这条报价能拿到多少天，用来算当前组合要花多少钱。
          </p>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>已添加的会员</label>
          {selected.length === 0 ? (
            <p className="joint-hint">还没有添加会员。至少添加两个才能记录联合报价。</p>
          ) : (
            <div className="joint-members">
              {entries.map((entry) => (
                <div key={entry.id} className="joint-member picked">
                  <div className="joint-member-main">
                    <strong>{entry.sub.serviceName}</strong>
                    <span>
                      {entry.sub.planName}
                      {entry.monthly === null
                        ? ' · 没有可比月均成本'
                        : ` · 当前 ${formatCNY(entry.monthly)}/月`}
                    </span>
                  </div>
                  <div className="joint-member-duration">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={entry.days}
                      aria-label={`${entry.sub.serviceName} 时长（天）`}
                      onChange={(event) =>
                        updateItem(entry.id, clampDays(event.target.value))
                      }
                    />
                    <span>天</span>
                  </div>
                  <span className="joint-member-cost">
                    {entry.currentCost === null ? '—' : formatCNY(entry.currentCost)}
                  </span>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => removeMember(entry.id)}
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-grid" style={{ marginTop: 14 }}>
          <div className="field">
            <label>平台 *</label>
            <input
              list="joint-quote-platforms"
              value={platform}
              placeholder="淘宝 / 闲鱼 / 拼车群"
              onChange={(event) => setPlatform(event.target.value)}
            />
            <datalist id="joint-quote-platforms">
              {PLATFORM_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>捆绑包总价（元）*</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={total}
              placeholder="0.00"
              onChange={(event) => setTotal(event.target.value)}
            />
          </div>
          <div className="field span-2">
            <label>默认天数</label>
            <div className="duration-input">
              <input
                type="number"
                min={1}
                max={3650}
                value={defaultDays}
                aria-label="默认天数"
                onChange={(event) => setDefaultDays(clampDays(event.target.value))}
              />
              <span>天</span>
              <button
                type="button"
                className="btn sm"
                onClick={applyDefault}
                disabled={selected.length === 0}
              >
                应用到全部
              </button>
            </div>
            <div className="duration-presets">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  className={`btn sm${defaultDays === preset.days ? ' active' : ''}`}
                  onClick={() => setDefaultDays(preset.days)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>看到价格的日期</label>
            <input
              type="date"
              value={capturedAt}
              onChange={(event) => setCapturedAt(event.target.value)}
            />
          </div>
          <div className="field">
            <label>怎么买 / 备注</label>
            <input
              value={note}
              placeholder="例如：代充；需要提供账号；含 4 个会员"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <div className="quote-preview">
          <div className="quote-preview-row">
            <span>当前组合总价</span>
            <strong>{selected.length === 0 ? '—' : formatCNY(currentTotal)}</strong>
          </div>
          <div className="quote-preview-row">
            <span>捆绑包总价</span>
            <strong>{formatCNY(totalFen)}</strong>
          </div>
          <div className="quote-preview-row">
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

        {error ? <div className="form-error">{error}</div> : null}

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={busy || selected.length < 2 || !platform.trim()}
          >
            {busy ? '保存中…' : '记录报价'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
