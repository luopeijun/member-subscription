export type ImportSummary = {
  servicesAdded: number
  plansAdded: number
  subscriptionsAdded: number
  jointRenewalsAdded: number
  jointQuotesAdded: number
  paymentsAdded: number
  snapshotsAdded: number
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('文件内容不是有效的 JSON')
  }
}

export function formatImportSummary(counts: ImportSummary): string {
  const parts = [
    `会员 ${counts.subscriptionsAdded} 条`,
    `支付 ${counts.paymentsAdded} 笔`,
    `报价 ${counts.snapshotsAdded} 条`,
  ]
  if (counts.jointRenewalsAdded > 0) {
    parts.push(`联合续费 ${counts.jointRenewalsAdded} 条`)
  }
  if (counts.jointQuotesAdded > 0) {
    parts.push(`联合报价 ${counts.jointQuotesAdded} 条`)
  }
  return `导入完成：${parts.join('、')}`
}
