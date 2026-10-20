import { useState, type FormEvent } from 'react'
import { api } from '@/api'
import type { AppState, SavedHandler, Subscription } from '@/types'
import { Modal } from '@/components/Modal/Modal'
import { toMajor, toMinor } from '@shared/money'
import {
  addDaysISO,
  daysBetweenISO,
  DURATION_PRESETS,
  MAX_DURATION_DAYS,
} from '@shared/duration'
import { formatDate } from '@/utils/format'
import './PaymentForm.scss'

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
  const [durationDays, setDurationDays] = useState('')
  const [nextRenewalDate, setNextRenewalDate] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const target = state.subscriptions.find((item) => item.id === subId)

  const baseFor = (paymentDate: string) =>
    target &&
    target.status !== 'planned' &&
    target.nextRenewalAt &&
    target.nextRenewalAt > paymentDate
      ? target.nextRenewalAt
      : paymentDate

  const base = paidAt ? baseFor(paidAt) : ''

  const readDuration = (value: string): number | null => {
    if (value.trim() === '') return null
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 1) return null
    return Math.floor(parsed)
  }

  const duration = readDuration(durationDays)
  const durationInvalid = durationDays.trim() !== '' && duration === null
  const durationTooLong = duration !== null && duration > MAX_DURATION_DAYS
  const dateInvalid =
    nextRenewalDate !== '' &&
    base !== '' &&
    daysBetweenISO(base, nextRenewalDate) < 1
  const preview =
    nextRenewalDate ||
    (duration !== null && base ? addDaysISO(base, duration) : null)

  const selectSubscription = (id: number) => {
    setSubId(id)
    setDurationDays('')
    setNextRenewalDate('')
    const nextTarget = state.subscriptions.find((item) => item.id === id)
    if (!nextTarget) return
    if (nextTarget.lastPayment) {
      setAmount(String(toMajor(nextTarget.lastPayment.amount)))
    } else if (nextTarget.listPrice) {
      setAmount(String(toMajor(nextTarget.listPrice)))
    } else {
      setAmount('')
    }
  }

  const changeDuration = (value: string) => {
    setDurationDays(value)
    const days = readDuration(value)
    setNextRenewalDate(days !== null && base ? addDaysISO(base, days) : '')
  }

  const changeNextRenewalDate = (value: string) => {
    setNextRenewalDate(value)
    if (!value || !base) {
      setDurationDays('')
      return
    }
    const days = daysBetweenISO(base, value)
    setDurationDays(days >= 1 ? String(days) : '')
  }

  const changePaidAt = (value: string) => {
    setPaidAt(value)
    if (!value) return
    const nextBase = baseFor(value)
    const days = readDuration(durationDays)
    if (days !== null) {
      setNextRenewalDate(addDaysISO(nextBase, days))
      return
    }
    if (nextRenewalDate) {
      const diff = daysBetweenISO(nextBase, nextRenewalDate)
      setDurationDays(diff >= 1 ? String(diff) : '')
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
    if (durationInvalid) {
      setError('续费时长至少为 1 天')
      return
    }
    if (durationTooLong) {
      setError(`续费时长最多为 ${MAX_DURATION_DAYS} 天`)
      return
    }
    if (dateInvalid) {
      setError('下次续费日需要晚于起算日')
      return
    }
    if (nextRenewalDate && duration === null) {
      setError('请检查下次续费日')
      return
    }

    setBusy(true)
    try {
      const next = await api<AppState>(`/subscriptions/${subId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          paidAt,
          amount: toMinor(amountNumber),
          durationDays: duration,
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
            : '记一笔续费'
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
            <input
              type="date"
              value={paidAt}
              onChange={(event) => changePaidAt(event.target.value)}
            />
          </div>
          <div className="field">
            <label>这次买到的时长（天，选填）</label>
            <input
              type="number"
              min="1"
              max={MAX_DURATION_DAYS}
              step="1"
              value={durationDays}
              placeholder="留空则按套餐周期"
              onChange={(event) => changeDuration(event.target.value)}
            />
          </div>
          <div className="field">
            <label>下次续费日（选填）</label>
            <input
              type="date"
              value={nextRenewalDate}
              min={base ? addDaysISO(base, 1) : undefined}
              max={base ? addDaysISO(base, MAX_DURATION_DAYS) : undefined}
              onChange={(event) => changeNextRenewalDate(event.target.value)}
            />
          </div>
          <div className="field span-2">
            <div className="duration-presets">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  className="btn sm"
                  onClick={() => changeDuration(String(preset.days))}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p
              className={`duration-hint${
                durationInvalid || durationTooLong || dateInvalid ? ' error' : ''
              }`}
            >
              {dateInvalid
                ? `下次续费日需要晚于起算日 ${formatDate(base)}。`
                : durationTooLong
                  ? `续费时长最多为 ${MAX_DURATION_DAYS} 天。`
                  : durationInvalid
                    ? '续费时长至少为 1 天。'
                    : preview && duration !== null
                      ? `${formatDate(base)} 起算，买到 ${duration} 天，下次续费日 ${formatDate(preview)}。`
                      : '时长和下次续费日会进行互相换算。留空时按套餐计费周期推算。'}
            </p>
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
