import { describe, expect, it } from 'vitest'

import { formatRemainingMs, getRemainingMs } from '@/shared/utils/time'

describe('time helpers', () => {
  it('tracks remaining time using server time offset', () => {
    const remaining = getRemainingMs(
      '2026-01-01T00:00:30.000Z',
      '2026-01-01T00:00:00.000Z',
      11_000,
      1_000,
    )

    expect(remaining).toBe(20_000)
  })

  it('falls back to client time when server time is absent', () => {
    const target = new Date('2026-01-01T00:00:30.000Z').getTime()
    const remaining = getRemainingMs(
      '2026-01-01T00:00:30.000Z',
      null,
      target - 7_000,
      target - 10_000,
    )

    expect(remaining).toBe(7_000)
  })

  it('formats minute and second countdown text', () => {
    expect(formatRemainingMs(125_000)).toBe('2m 05s')
    expect(formatRemainingMs(9_000)).toBe('9s')
  })
})
