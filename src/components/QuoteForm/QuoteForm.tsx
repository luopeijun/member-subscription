import { useState, type FormEvent } from 'react'
import { api } from '@/api'
import type { AppState, Plan, SavedHandler, Snapshot } from '@/types'
import { CATEGORIES } from '@/constants'
import { cycleLabel } from '@/utils/cycle'
import {
  createQuoteDraft,
  quotePayload,
  validateQuoteDraft,
  type QuoteDraft,
} from '@/utils/quote'
import { FormSectionTitle } from '@/components/FormSectionTitle/FormSectionTitle'
import { Modal } from '@/components/Modal/Modal'
import { QuoteFields } from '@/components/QuoteFields/QuoteFields'
import { toMajor } from '@shared/money'

/* ---------------------------------- 平台报价 --------------------------------- */

type QuoteFormProps = {
  state: AppState
  plan?: Plan
  snapshot?: Snapshot
  onClose: () => void
  onSaved: SavedHandler
}

export function QuoteForm({ state, plan, snapshot, onClose, onSaved }: QuoteFormProps) {
  const isNew = !plan
  const isEdit = Boolean(snapshot)
  const [serviceName, setServiceName] = useState(plan?.serviceName ?? '')
  const [category, setCategory] = useState(plan?.category ?? '影音娱乐')
  const [planName, setPlanName] = useState(plan?.name ?? '')
  const [quote, setQuote] = useState<QuoteDraft>(() =>
    snapshot
      ? {
          platform: snapshot.platform ?? '',
          price: String(toMajor(snapshot.price)),
          capturedAt: snapshot.capturedAt,
          durationDays:
            snapshot.durationDays === null ? '' : String(snapshot.durationDays),
          cycleMonths: snapshot.cycleMonths,
          cycleDays: snapshot.cycleDays,
        }
      : {
          ...createQuoteDraft(
            state.today,
            plan?.cycleMonths ?? 12,
            plan?.cycleDays ?? null,
          ),
          price: plan?.listPrice ? String(toMajor(plan.listPrice)) : '',
        },
  )
  const [note, setNote] = useState(snapshot?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const patchQuote = (patch: Partial<QuoteDraft>) => {
    setQuote((current) => ({ ...current, ...patch }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (isNew) {
      if (!serviceName.trim()) {
        setError('请填写服务名称')
        return
      }
      if (!planName.trim()) {
        setError('请填写套餐名称')
        return
      }
    }

    const quoteError = validateQuoteDraft(quote)
    if (quoteError) {
      setError(quoteError)
      return
    }

    setBusy(true)
    try {
      const payload = quotePayload(quote, note.trim() || null)
      const next = snapshot
        ? await api<AppState>(`/snapshots/${snapshot.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
        : plan
          ? await api<AppState>('/snapshots', {
              method: 'POST',
              body: JSON.stringify({ planId: plan.id, ...payload }),
            })
          : await api<AppState>('/plans', {
              method: 'POST',
              body: JSON.stringify({
                serviceName: serviceName.trim(),
                category,
                planName: planName.trim(),
                cycleMonths: quote.cycleMonths,
                cycleDays: quote.cycleDays,
                listPrice: payload.price,
                note: note.trim() || null,
                quote: payload,
              }),
            })
      onSaved(
        next,
        snapshot
          ? '平台报价已更新'
          : plan
            ? '平台报价已记录'
            : '套餐和平台报价已添加',
      )
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={isEdit ? '编辑平台报价' : '记录平台报价'}
      subtitle={
        plan
          ? `${plan.serviceName} · ${plan.name} · ${cycleLabel(plan.cycleMonths, plan.cycleDays)}`
          : '新套餐会按这次报价创建，只用于比价'
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <FormSectionTitle
          title="套餐信息"
          hint={isEdit ? '编辑时不可修改套餐' : plan ? '已选套餐' : '新套餐，保存后自动创建'}
        />
        <div className="form-grid">
          <div className="field">
            <label>服务名称 *</label>
            <input
              list="known-services-quote"
              value={serviceName}
              disabled={Boolean(plan)}
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
            <datalist id="known-services-quote">
              {state.services.map((service) => (
                <option key={service.id} value={service.name} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>类别</label>
            <select
              value={category}
              disabled={Boolean(plan)}
              onChange={(event) => setCategory(event.target.value)}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="field span-2">
            <label>套餐名称 *</label>
            <input
              value={planName}
              disabled={Boolean(plan)}
              placeholder="高级会员 / 家庭组"
              onChange={(event) => setPlanName(event.target.value)}
            />
          </div>
        </div>

        <FormSectionTitle title="报价信息" hint="平台价格与套餐总时长" />
        <QuoteFields
          value={quote}
          onChange={patchQuote}
          idPrefix={plan ? `snapshot-${plan.id}` : 'new-quote'}
        />

        <div className="field" style={{ marginTop: 12 }}>
          <label>购买方式 / 备注</label>
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
            {busy
              ? '保存中…'
              : isEdit
                ? '保存修改'
                : plan
                  ? '保存报价'
                  : '保存并添加套餐'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
