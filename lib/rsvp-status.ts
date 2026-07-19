import { ApiError } from '@/lib/api'
import type { RsvpStatus } from '@/lib/types'

// Translates the database's RSVP outcome into an HTTP result.
//
// A retry that finds the seat already held is a success, not a conflict: the
// caller asked for a seat and has one. Only a genuinely full event is a 409.
export function rsvpResponseFor(status: RsvpStatus): { status: number; error?: ApiError } {
  switch (status) {
    case 'confirmed':
      return { status: 201 }
    case 'already_rsvpd':
      return { status: 200 }
    case 'event_full':
      return {
        status: 409,
        error: new ApiError(409, 'event_full', 'This event is full — someone took the last seat'),
      }
    case 'event_started':
      return {
        status: 422,
        error: new ApiError(422, 'event_started', 'This event has already started'),
      }
    case 'event_not_found':
      return {
        status: 404,
        error: new ApiError(404, 'event_not_found', 'No such event'),
      }
  }
}
