import { describe, expect, it } from 'vitest'
import { formatImportSummary, readJsonFile, type ImportSummary } from '@/utils/import'

function makeFile(text: string): File {
  return { text: async () => text } as File
}

const baseSummary: ImportSummary = {
  servicesAdded: 1,
  plansAdded: 2,
  subscriptionsAdded: 3,
  jointRenewalsAdded: 0,
  jointQuotesAdded: 0,
  paymentsAdded: 4,
  snapshotsAdded: 5,
}

describe('readJsonFile', () => {
  it('parses JSON file contents', async () => {
    await expect(readJsonFile(makeFile('{"a":1}'))).resolves.toEqual({ a: 1 })
    await expect(readJsonFile(makeFile('[1,2,3]'))).resolves.toEqual([1, 2, 3])
    await expect(readJsonFile(makeFile('null'))).resolves.toBeNull()
  })

  it('rejects invalid JSON with a user-facing message', async () => {
    await expect(readJsonFile(makeFile('{'))).rejects.toThrow(
      '文件内容不是有效的 JSON',
    )
  })
})

describe('formatImportSummary', () => {
  it('formats required counts', () => {
    expect(formatImportSummary(baseSummary)).toBe(
      '导入完成：会员 3 条、支付 4 笔、报价 5 条',
    )
  })

  it('includes joint renewal and joint quote counts when present', () => {
    expect(
      formatImportSummary({
        ...baseSummary,
        jointRenewalsAdded: 2,
        jointQuotesAdded: 1,
      }),
    ).toBe('导入完成：会员 3 条、支付 4 笔、报价 5 条、联合续费 2 条、联合报价 1 条')
  })
})
