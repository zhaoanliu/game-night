export const GAME_TYPES = ['boardgame', 'tcg', 'rpg', 'miniatures', 'party', 'other'] as const
export type GameType = (typeof GAME_TYPES)[number]

export type Role = 'player' | 'organizer'

// Which slice of a player's RSVPs to return: what's coming up, or what has
// already happened.
export const EVENT_WINDOWS = ['upcoming', 'past'] as const
export type EventWindow = (typeof EVENT_WINDOWS)[number]

export interface User {
  id: string
  name: string
  role: Role
}

export interface GameEvent {
  id: string
  organizer_id: string
  title: string
  game_type: GameType
  starts_at: string
  location: string
  capacity: number
  created_at: string
  updated_at: string
}

export interface EventWithCount extends GameEvent {
  attendee_count: number
  seats_left: number
}

export type RsvpStatus =
  | 'confirmed'
  | 'already_rsvpd'
  | 'event_full'
  | 'event_started'
  | 'event_not_found'

export type CancelStatus = 'cancelled' | 'not_rsvpd'

export interface Attendee {
  id: string
  name: string
  created_at: string
}
