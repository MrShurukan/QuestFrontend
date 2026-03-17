import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LiveCountdown } from '@/shared/ui/ui'

describe('LiveCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down from server time', () => {
    render(
      <LiveCountdown
        targetIso="2026-01-01T00:00:30.000Z"
        serverTimeIso="2026-01-01T00:00:00.000Z"
      />,
    )

    expect(screen.getByText('30s')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    expect(screen.getByText('29s')).toBeInTheDocument()
  })

  it('shows empty label when countdown is already finished', () => {
    render(
      <LiveCountdown
        targetIso="2026-01-01T00:00:00.000Z"
        serverTimeIso="2026-01-01T00:00:00.000Z"
        emptyLabel="ready"
      />,
    )

    expect(screen.getByText('ready')).toBeInTheDocument()
  })
})
