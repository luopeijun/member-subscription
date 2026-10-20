import { useState, type FormEvent } from 'react'
import { api } from '@/api'
import type { AppState, SavedHandler, Subscription } from '@/types'
import { PLATFORM_SUGGESTIONS } from '@/constants'
import { Modal } from '@/components/Modal/Modal'
import { formatCNY, toMinor } from '@shared/money'
import { DAYS_PER_MONTH, DURATION_PRESETS } from '@shared/duration'
import { clampDurationDays } from '@/utils/duration'
import './JointQuoteForm.scss'

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
                        updateItem(entry.id, clampDurationDays(event.target.value))
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
                onChange={(event) => setDefaultDays(clampDurationDays(event.target.value))}
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
