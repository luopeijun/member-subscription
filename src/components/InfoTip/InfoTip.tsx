import './InfoTip.scss'

type InfoTipProps = {
  text: string
  label?: string
}

export function InfoTip({ text, label = '说明' }: InfoTipProps) {
  return (
    <span className="info-tip" tabIndex={0} aria-label={label}>
      <span className="info-tip-icon" aria-hidden="true">
        i
      </span>
      <span className="info-tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  )
}
