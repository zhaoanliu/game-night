import { describe, it, expect } from 'vitest'
import { rsvpResponseFor } from '@/lib/rsvp-status'
import type { RsvpStatus } from '@/lib/types'

describe('rsvpResponseFor', () => {
  it('treats a new seat as created', () => {
    expect(rsvpResponseFor('confirmed')).toEqual({ status: 201 })
  })

  it('treats a repeat submission as a plain success, not a conflict', () => {
    const outcome = rsvpResponseFor('already_rsvpd')
    expect(outcome.status).toBe(200)
    expect(outcome.error).toBeUndefined()
  })

  it('maps a full event to 409 with a message a player can act on', () => {
    const outcome = rsvpResponseFor('event_full')
    expect(outcome.status).toBe(409)
    expect(outcome.error?.code).toBe('event_full')
    expect(outcome.error?.message).toMatch(/full/i)
  })

  it('maps a started event to 422', () => {
    expect(rsvpResponseFor('event_started').error?.code).toBe('event_started')
    expect(rsvpResponseFor('event_started').status).toBe(422)
  })

  it('maps an unknown event to 404', () => {
    expect(rsvpResponseFor('event_not_found').error?.code).toBe('event_not_found')
    expect(rsvpResponseFor('event_not_found').status).toBe(404)
  })

  it('handles every status the database can return', () => {
    const all: RsvpStatus[] = [
      'confirmed',
      'already_rsvpd',
      'event_full',
      'event_started',
      'event_not_found',
    ]
    for (const status of all) {
      expect(rsvpResponseFor(status).status).toBeGreaterThanOrEqual(200)
    }
  })
})
