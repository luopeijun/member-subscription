import { DURATION_PRESETS, MAX_DURATION_DAYS } from '@shared/duration'
import { PLATFORM_SUGGESTIONS } from '@/constants'
import { cycleKey, cycleOptions, readCycle } from '@/utils/cycle'
import {
  quoteDurationDays,
  quoteDurationError,
  quoteDurationTerm,
  quoteMonthly,
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
  const durationDays = quoteDurationDays(value)
  const durationTerm = quoteDurationTerm(value)
  const monthly = quoteMonthly(value)
  const durationError = quoteDurationError(value)
  const hasDuration = value.durationDays.trim() !== ''

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
          套餐总时长（天，选填）
          <InfoTip text="填写该报价包含的总时长（天）；未填写时按计费周期折算。365 天按 1 年计算。" />
        </label>
        <div className="duration-input quote-duration-input">
          <input
            type="number"
            min={1}
            max={MAX_DURATION_DAYS}
            step={1}
            value={value.durationDays}
            placeholder="按计费周期折算"
            aria-label="套餐总时长（天）"
            onChange={(event) => onChange({ durationDays: event.target.value })}
          />
          <span>天</span>
        </div>
        <div className="duration-presets">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.days}
              type="button"
              className={`btn sm${durationDays === preset.days ? ' active' : ''}`}
              onClick={() => onChange({ durationDays: String(preset.days) })}
            >
              {preset.label}
            </button>
          ))}
        </div>
        {durationError ? (
          <p className="quote-duration-summary invalid">{durationError}</p>
        ) : hasDuration && durationDays !== null ? (
          <p className="quote-duration-summary">
            总时长 <strong>{durationDays} 天</strong>
            {durationTerm ? <>（约 {durationTerm}）</> : null}
            {monthly !== null ? (
              <>
                {' '}
                · 等效月成本 <strong>{formatCNY(monthly)}</strong>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  )
}
