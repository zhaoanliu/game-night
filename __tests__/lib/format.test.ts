import { describe, expect, it } from 'vitest'
import { GAME_TYPE_LABELS, formatEventTime, isInProgress, seatsLabel } from '@/lib/format'
import { GAME_TYPES } from '@/lib/types'

describe('formatEventTime', () => {
  it('renders a same-day event as one date with a time range', () => {
    const result = formatEventTime('2026-08-07T19:00:00Z', '2026-08-07T23:00:00Z', 'UTC')
    expect(result).toBe('Fri, Aug 7, 7:00 PM – 11:00 PM')
  })

  it('repeats the date when the event crosses midnight', () => {
    const result = formatEventTime('2026-08-07T22:00:00Z', '2026-08-08T02:00:00Z', 'UTC')
    expect(result).toBe('Fri, Aug 7, 10:00 PM – Sat, Aug 8, 2:00 AM')
  })

  it('respects the injected time zone', () => {
    const result = formatEventTime('2026-08-08T02:00:00Z', '2026-08-08T05:00:00Z', 'America/Los_Angeles')
    expect(result).toBe('Fri, Aug 7, 7:00 PM – 10:00 PM')
  })
})

describe('seatsLabel', () => {
  it('is Full at zero and below', () => {
    expect(seatsLabel(0)).toBe('Full')
    expect(seatsLabel(-1)).toBe('Full')
  })

  it('is singular at one', () => {
    expect(seatsLabel(1)).toBe('1 seat left')
  })

  it('is plural above one', () => {
    expect(seatsLabel(7)).toBe('7 seats left')
  })
})

describe('isInProgress', () => {
  const now = Date.parse('2026-08-07T20:00:00Z')

  it('is true between start and end', () => {
    expect(isInProgress('2026-08-07T19:00:00Z', '2026-08-07T23:00:00Z', now)).toBe(true)
  })

  it('is false before start and after end', () => {
    expect(isInProgress('2026-08-07T21:00:00Z', '2026-08-07T23:00:00Z', now)).toBe(false)
    expect(isInProgress('2026-08-07T15:00:00Z', '2026-08-07T18:00:00Z', now)).toBe(false)
  })
})

describe('GAME_TYPE_LABELS', () => {
  it('covers every game type', () => {
    for (const type of GAME_TYPES) {
      expect(GAME_TYPE_LABELS[type]).toBeTruthy()
    }
  })
})
