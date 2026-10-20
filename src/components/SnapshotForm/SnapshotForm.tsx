import { useState, type FormEvent } from 'react'
import { api } from '@/api'
import type { AppState, Plan, SavedHandler } from '@/types'
import { PLATFORM_SUGGESTIONS } from '@/constants'
import { cycleKey, cycleLabel, cycleOptions, readCycle } from '@/utils/cycle'
import { formatTermDays } from '@/utils/snapshot'
import { Modal } from '@/components/Modal/Modal'
import { DAYS_PER_MONTH, daysBetweenISO } from '@shared/duration'
import { formatCNY, toMajor, toMinor } from '@shared/money'
import './SnapshotForm.scss'

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
  const [cycleDays, setCycleDays] = useState<number | null>(plan.cycleDays)
  const [capturedAt, setCapturedAt] = useState(today)
  const [expiresAt, setExpiresAt] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const priceNumber = Number(price)
  const priceMinor =
    price !== '' && Number.isFinite(priceNumber) && priceNumber >= 0
      ? toMinor(priceNumber)
      : null
  const expiryDays =
    expiresAt && capturedAt ? daysBetweenISO(capturedAt, expiresAt) : null
  const hasValidExpiry = expiryDays !== null && expiryDays > 0
  const expiryTerm =
    hasValidExpiry && expiryDays !== null ? formatTermDays(expiryDays) : null
  const expiryMonthly =
    hasValidExpiry && expiryDays !== null && priceMinor !== null
      ? Math.round((priceMinor * DAYS_PER_MONTH) / expiryDays)
      : null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (priceMinor === null) {
      setError('请填写价格')
      return
    }
    if (!platform.trim()) {
      setError('请填写平台名称')
      return
    }
    if (!capturedAt) {
      setError('请填写记录日期')
      return
    }
    if (expiresAt && !hasValidExpiry) {
      setError('到期日需要晚于记录日期')
      return
    }
    setBusy(true)
    try {
      const next = await api<AppState>('/snapshots', {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.id,
          capturedAt,
          expiresAt: expiresAt || null,
          price: priceMinor,
          cycleMonths,
          cycleDays,
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
      subtitle={`${plan.serviceName} · ${plan.name} · ${cycleLabel(plan.cycleMonths, plan.cycleDays)}`}
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
              value={cycleKey(cycleMonths, cycleDays)}
              onChange={(event) => {
                const next = readCycle(event.target.value)
                setCycleMonths(next.cycleMonths)
                setCycleDays(next.cycleDays)
              }}
            >
              {cycleOptions(cycleMonths, cycleDays).map((item) => (
                <option key={item.key} value={item.key}>
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
          <div className="field span-2">
            <label>会员到期日（可选）</label>
            <div className="quote-expiry-row">
              <input
                type="date"
                className="quote-expiry-input"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
              <span
                className={`quote-expiry-help ${
                  expiresAt && !hasValidExpiry ? 'invalid' : ''
                }`}
              >
                {expiresAt ? (
                  hasValidExpiry ? (
                    <>
                      实际时长约 <strong>{expiryTerm}</strong>
                      {expiryMonthly !== null ? (
                        <>
                          {' '}
                          · 等效月成本 <strong>{formatCNY(expiryMonthly)}</strong>
                        </>
                      ) : null}
                    </>
                  ) : (
                    '到期日需要晚于记录日期'
                  )
                ) : (
                  '不填就按计费周期折算；遇到 1 年 3 个月这类固定到期日时填这里'
                )}
              </span>
            </div>
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
