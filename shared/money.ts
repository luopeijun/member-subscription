export function toMinor(yuan: number): number {
  return Math.round(yuan * 100)
}

export function toMajor(fen: number): number {
  return fen / 100
}

export function formatCNY(fen: number): string {
  const value = fen / 100
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}
