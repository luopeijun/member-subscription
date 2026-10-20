import './PageHeader.scss'

type PageHeaderProps = {
  title: string
  subtitle: string
  today: string
}

export function PageHeader({ title, subtitle, today }: PageHeaderProps) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <span className="today-pill">今天 {today}</span>
    </div>
  )
}
