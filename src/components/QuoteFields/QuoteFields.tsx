import { PLATFORM_SUGGESTIONS } from '@/constants'
import { cycleKey, cycleOptions, readCycle } from '@/utils/cycle'
import {
  quoteExpiryDays,
  quoteExpiryMonthly,
  quoteExpiryTerm,
  type QuoteDraft,
} from '@/utils/quote'
import { formatCNY } from '@shared/money'
import { InfoTip } from '@/components/InfoTip/InfoTip'
import './QuoteFields.scss'

type QuoteFieldsProps = {
  value: QuoteDraft
  onChange: (patch: Partial<QuoteDraft>) => void
  idPrefix: string
}

export function QuoteFields({ value, onChange, idPrefix }: QuoteFieldsProps) {
  const expiryDays = quoteExpiryDays(value)
  const expiryTerm = quoteExpiryTerm(value)
  const expiryMonthly = quoteExpiryMonthly(value)
  const hasExpiry = Boolean(value.expiresAt)

  return (
    <div className="form-grid quote-fields">
      <div className="field">
        <label>平台 *</label>
        <input
          list={`${idPrefix}-platforms`}
          value={value.platform}
          placeholder="官网 / 淘宝 / 闲鱼 / 拼车群"
          onChange={(event) => onChange({ platform: event.target.value })}
        />
        <datalist id={`${idPrefix}-platforms`}>
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
          value={value.price}
          placeholder="0.00"
          onChange={(event) => onChange({ price: event.target.value })}
        />
      </div>
      <div className="field">
        <label>计费周期</label>
        <select
          value={cycleKey(value.cycleMonths, value.cycleDays)}
          onChange={(event) => {
            const next = readCycle(event.target.value)
            onChange({
              cycleMonths: next.cycleMonths,
              cycleDays: next.cycleDays,
            })
          }}
        >
          {cycleOptions(value.cycleMonths, value.cycleDays).map((item) => (
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
          className="quote-date-input"
          value={value.capturedAt}
          onChange={(event) => onChange({ capturedAt: event.target.value })}
        />
      </div>
      <div className="field span-2">
        <label className="label-with-tip">
          会员到期日（可选）
          <InfoTip text="不填写按照计费周期折算，不固定计费周期可填写具体到期时间" />
        </label>
        <input
          type="date"
          className="quote-expiry-input"
          value={value.expiresAt}
          onChange={(event) => onChange({ expiresAt: event.target.value })}
        />
        {hasExpiry ? (
          expiryDays !== null ? (
            <p className="quote-expiry-summary">
              实际时长约 <strong>{expiryTerm}</strong>
              {expiryMonthly !== null ? (
                <>
                  {' '}
                  · 等效月成本 <strong>{formatCNY(expiryMonthly)}</strong>
                </>
              ) : null}
            </p>
          ) : (
            <p className="quote-expiry-summary invalid">
              到期日需要晚于记录日期
            </p>
          )
        ) : null}
      </div>
    </div>
  )
}
