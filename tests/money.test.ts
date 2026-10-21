import { describe, expect, it } from 'vitest'
import { formatCNY, toMajor, toMinor } from '@shared/money'

describe('money', () => {
  it('converts yuan to fen with rounding', () => {
    expect(toMinor(12.34)).toBe(1234)
    expect(toMinor(0.1 + 0.2)).toBe(30)
    expect(toMinor(19.995)).toBe(2000)
  })

  it('converts fen to yuan', () => {
    expect(toMajor(1234)).toBe(12.34)
    expect(toMajor(0)).toBe(0)
  })

  it('formats fen as CNY with two decimals and grouping', () => {
    expect(formatCNY(0)).toBe('¥0.00')
    expect(formatCNY(5)).toBe('¥0.05')
    expect(formatCNY(123450)).toBe('¥1,234.50')
    expect(formatCNY(123456)).toBe('¥1,234.56')
  })
})
