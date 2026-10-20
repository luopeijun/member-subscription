import './Toast.scss'

export type ToastKind = 'ok' | 'err'

type ToastProps = {
  message: string
  kind: ToastKind
}

export function Toast({ message, kind }: ToastProps) {
  return <div className={`toast ${kind}`}>{message}</div>
}
