import { describe, expect, it } from 'vitest'

import { describeQrState } from '@/features/public/qr-state'

describe('describeQrState', () => {
  it('marks resolved QR as success', () => {
    expect(describeQrState('resolved')).toEqual({
      title: 'Вопрос открыт',
      tone: 'success',
    })
  })

  it('marks auth and team blockers as warning', () => {
    expect(describeQrState('requires_auth').tone).toBe('warning')
    expect(describeQrState('requires_team').tone).toBe('warning')
  })

  it('marks unavailable QR states as danger', () => {
    expect(describeQrState('not_found').tone).toBe('danger')
    expect(describeQrState('unavailable').tone).toBe('danger')
  })
})
