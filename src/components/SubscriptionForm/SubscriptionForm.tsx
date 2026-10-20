import { useState, type FormEvent } from 'react'
import { api } from '@/api'
import type { AppState, SavedHandler, Subscription } from '@/types'
import { CATEGORIES, PLATFORM_SUGGESTIONS, STATUS_OPTIONS } from '@/constants'
import { FormSectionTitle } from '@/components/FormSectionTitle/FormSectionTitle'
import { Modal } from '@/components/Modal/Modal'
import { CYCLE_OPTIONS } from '@/utils/cycle'
import { toMajor, toMinor } from '@shared/money'

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
        <FormSectionTitle title="服务与套餐" />
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

        <FormSectionTitle title="价格与支付" hint="所有金额按人民币记账" />
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

        <FormSectionTitle title="订阅信息" />
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
