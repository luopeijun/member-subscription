import { describe, expect, it } from 'vitest'
import { allocateJointQuoteAmounts } from '../server/allocation'

describe('allocateJointQuoteAmounts', () => {
  it('returns an empty allocation for no members', () => {
    expect(allocateJointQuoteAmounts(100, [], 'split', 0)).toEqual([])
  })

  it('splits equal durations evenly', () => {
    expect(allocateJointQuoteAmounts(100, [10, 10], 'split', 0)).toEqual([
      50, 50,
    ])
  })

  it('splits by duration and assigns the remainder to the main member', () => {
    expect(allocateJointQuoteAmounts(100, [1, 2], 'split', 0)).toEqual([34, 66])
    expect(allocateJointQuoteAmounts(100, [1, 2], 'split', 1)).toEqual([33, 67])
    expect(allocateJointQuoteAmounts(10, [1, 1, 1], 'split', 0)).toEqual([
      4, 3, 3,
    ])
  })

  it('preserves the total amount after splitting', () => {
    const amounts = allocateJointQuoteAmounts(1000, [30, 45, 25, 10], 'split', 2)
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(1000)
  })

  it('assigns the full amount to the main member in main mode', () => {
    expect(allocateJointQuoteAmounts(100, [30, 70], 'main', 0)).toEqual([100, 0])
    expect(allocateJointQuoteAmounts(100, [30, 70], 'main', 1)).toEqual([0, 100])
  })

  it('falls back to the first member when the main index is invalid', () => {
    expect(allocateJointQuoteAmounts(100, [30, 70], 'main', 5)).toEqual([100, 0])
    expect(allocateJointQuoteAmounts(100, [30, 70], 'main', -1)).toEqual([100, 0])
    expect(allocateJointQuoteAmounts(100, [1, 2], 'split', 5)).toEqual([34, 66])
  })

  it('returns zeros when split durations have no total days', () => {
    expect(allocateJointQuoteAmounts(100, [0, 0], 'split', 0)).toEqual([0, 0])
  })

  it('handles a single member and a zero total', () => {
    expect(allocateJointQuoteAmounts(100, [30], 'split', 0)).toEqual([100])
    expect(allocateJointQuoteAmounts(0, [30, 70], 'split', 0)).toEqual([0, 0])
    expect(allocateJointQuoteAmounts(0, [30, 70], 'main', 1)).toEqual([0, 0])
  })
})
