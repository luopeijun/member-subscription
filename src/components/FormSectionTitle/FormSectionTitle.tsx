type FormSectionTitleProps = {
  title: string
  hint?: string
}

export function FormSectionTitle({ title, hint }: FormSectionTitleProps) {
  return (
    <div className="form-section-title">
      <span>{title}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  )
}
