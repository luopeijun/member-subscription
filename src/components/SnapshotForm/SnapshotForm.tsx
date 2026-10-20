import { useState, type FormEvent } from 'react'
import { api } from '@/api'
import type { AppState, Plan, SavedHandler } from '@/types'
import { PLATFORM_SUGGESTIONS } from '@/constants'
import { CYCLE_OPTIONS, cycleLabel } from '@/utils/cycle'
import { Modal } from '@/components/Modal/Modal'
import { toMajor, toMinor } from '@shared/money'

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
