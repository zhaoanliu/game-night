import { ApiError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/service'
import type { CancelStatus, RsvpStatus } from '@/lib/types'

// The only way to claim or release a seat. Both functions take a row lock on
// the event and are the sole holders of write privilege on rsvps — see
// doc/data-model-and-concurrency.md. Never reach for the table directly; the
// database will refuse it anyway.
export async function rsvpToEvent(eventId: string, playerId: string): Promise<RsvpStatus> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('rsvp_to_event', {
    p_event_id: eventId,
    p_player_id: playerId,
  })

  if (error) {
    if (error.code === '22P02') return 'event_not_found'
    console.error('rsvp_to_event failed:', error.message, error)
    throw new ApiError(500, 'internal_error', 'Could not complete your RSVP')
  }

  return data as RsvpStatus
}

export async function cancelRsvp(eventId: string, playerId: string): Promise<CancelStatus> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('cancel_rsvp', {
    p_event_id: eventId,
    p_player_id: playerId,
  })

  if (error) {
    if (error.code === '22P02') return 'not_rsvpd'
    console.error('cancel_rsvp failed:', error.message, error)
    throw new ApiError(500, 'internal_error', 'Could not cancel your RSVP')
  }

  return data as CancelStatus
}
