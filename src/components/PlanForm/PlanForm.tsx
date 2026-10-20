import { useState, type FormEvent } from 'react'
import { api } from '@/api'
import type { AppState, SavedHandler } from '@/types'
import { CATEGORIES } from '@/constants'
import { CYCLE_OPTIONS } from '@/utils/cycle'
import { Modal } from '@/components/Modal/Modal'
import { toMinor } from '@shared/money'

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
