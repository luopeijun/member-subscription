import { useState, type FormEvent } from 'react'
import { api } from '@/api'
import type { AppState, SavedHandler, Subscription } from '@/types'
import { Modal } from '@/components/Modal/Modal'
import { toMajor, toMinor } from '@shared/money'

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
