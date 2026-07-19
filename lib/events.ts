import { ApiError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/service'
import type { EventWithCount, GameType } from '@/lib/types'

// Every column of events, plus the read-time attendee count.
const EVENT_COLUMNS =
  'id, organizer_id, title, game_type, starts_at, location, capacity, created_at, updated_at, attendee_count'

type CountedRow = Omit<EventWithCount, 'seats_left'>

function withSeatsLeft(row: CountedRow): EventWithCount {
  return { ...row, seats_left: Math.max(0, row.capacity - row.attendee_count) }
}

export interface EventQuery {
  search?: string | null
  gameType?: GameType
}

// Upcoming events, soonest first. Past events are never listed — the primary
// user is deciding what to attend, not reviewing history.
export async function listUpcomingEvents({ search, gameType }: EventQuery = {}): Promise<EventWithCount[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('events_with_counts')
    .select(EVENT_COLUMNS)
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })

  if (gameType) query = query.eq('game_type', gameType)

  if (search?.trim()) {
    // Free text matches either the event name or where it is being held.
    const term = `%${search.trim().replace(/[%_]/g, (c) => `\\${c}`)}%`
    query = query.or(`title.ilike.${term},location.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) {
    console.error('listUpcomingEvents failed:', error.message, error)
    throw new ApiError(500, 'internal_error', 'Could not load events')
  }

  return (data as CountedRow[]).map(withSeatsLeft)
}

export async function getEvent(id: string): Promise<EventWithCount> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('events_with_counts')
    .select(EVENT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error && error.code !== '22P02') {
    console.error('getEvent failed:', error.message, error)
    throw new ApiError(500, 'internal_error', 'Could not load event')
  }
  if (!data) {
    throw new ApiError(404, 'event_not_found', 'No such event')
  }

  return withSeatsLeft(data as CountedRow)
}

// The events a player holds a seat at, upcoming only, soonest first.
//
// Two queries rather than an embedded join: events_with_counts is a view, and
// PostgREST cannot infer a foreign key from rsvps to a view. Two indexed
// lookups are clearer than teaching it a synthetic relationship.
export async function listPlayerEvents(playerId: string): Promise<EventWithCount[]> {
  const supabase = createServiceClient()
  const { data: rsvps, error: rsvpError } = await supabase
    .from('rsvps')
    .select('event_id')
    .eq('player_id', playerId)

  if (rsvpError) {
    console.error('listPlayerEvents rsvps failed:', rsvpError.message, rsvpError)
    throw new ApiError(500, 'internal_error', 'Could not load your events')
  }

  const eventIds = (rsvps ?? []).map((r) => r.event_id as string)
  if (eventIds.length === 0) return []

  const { data, error } = await supabase
    .from('events_with_counts')
    .select(EVENT_COLUMNS)
    .in('id', eventIds)
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })

  if (error) {
    console.error('listPlayerEvents failed:', error.message, error)
    throw new ApiError(500, 'internal_error', 'Could not load your events')
  }

  return (data as CountedRow[]).map(withSeatsLeft)
}

export async function hasRsvp(eventId: string, playerId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('rsvps')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('player_id', playerId)
    .maybeSingle()

  if (error && error.code !== '22P02') {
    console.error('hasRsvp failed:', error.message, error)
    throw new ApiError(500, 'internal_error', 'Could not load your RSVP')
  }

  return Boolean(data)
}
