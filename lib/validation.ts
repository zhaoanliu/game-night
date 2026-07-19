import { ApiError } from '@/lib/api'
import {
  DEFAULT_DURATION_MINUTES,
  EVENT_WINDOWS,
  GAME_TYPES,
  type EventWindow,
  type GameType,
} from '@/lib/types'

// Defaults to upcoming: the common case is a player checking what they have
// coming up, and history should cost an explicit ask.
export function parseEventWindow(value: string | null): EventWindow {
  if (!value) return 'upcoming'
  if (!(EVENT_WINDOWS as readonly string[]).includes(value)) {
    throw new ApiError(
      400,
      'invalid_window',
      `Unknown window: ${value}. Expected one of: ${EVENT_WINDOWS.join(', ')}`
    )
  }
  return value as EventWindow
}

export function parseGameType(value: string | null): GameType | undefined {
  if (!value) return undefined
  if (!(GAME_TYPES as readonly string[]).includes(value)) {
    throw new ApiError(400, 'invalid_game_type', `Unknown game type: ${value}`)
  }
  return value as GameType
}

export interface EventInput {
  title: string
  game_type: GameType
  starts_at: string
  ends_at: string
  location: string
  capacity: number
}

export const CAPACITY_MAX = 1000
export const TITLE_MAX = 120
export const LOCATION_MAX = 200
export const MAX_DURATION_HOURS = 24 * 7

export function validateEventInput(input: unknown): EventInput {
  if (typeof input !== 'object' || input === null) {
    throw new ApiError(400, 'validation_error', 'Request body must be a JSON object')
  }
  const body = input as Record<string, unknown>
  const fields: Record<string, string> = {}

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length < 1 || title.length > TITLE_MAX) {
    fields.title = `Title is required (max ${TITLE_MAX} characters)`
  }

  const gameType = body.game_type
  if (typeof gameType !== 'string' || !(GAME_TYPES as readonly string[]).includes(gameType)) {
    fields.game_type = `Game type must be one of: ${GAME_TYPES.join(', ')}`
  }

  const startsAtRaw = body.starts_at
  let startsAt = ''
  if (typeof startsAtRaw !== 'string' || Number.isNaN(Date.parse(startsAtRaw))) {
    fields.starts_at = 'Start time must be a valid ISO 8601 date'
  } else if (Date.parse(startsAtRaw) <= Date.now()) {
    fields.starts_at = 'Start time must be in the future'
  } else {
    startsAt = new Date(startsAtRaw).toISOString()
  }

  // Optional: an organizer who doesn't care gets the default session length.
  // Validated against the start time, so a bad pair is caught here rather than
  // by the database's check constraint.
  const endsAtRaw = body.ends_at
  let endsAt = ''
  if (endsAtRaw === undefined || endsAtRaw === null || endsAtRaw === '') {
    if (startsAt) {
      endsAt = new Date(Date.parse(startsAt) + DEFAULT_DURATION_MINUTES * 60_000).toISOString()
    }
  } else if (typeof endsAtRaw !== 'string' || Number.isNaN(Date.parse(endsAtRaw))) {
    fields.ends_at = 'End time must be a valid ISO 8601 date'
  } else if (startsAt && Date.parse(endsAtRaw) <= Date.parse(startsAt)) {
    fields.ends_at = 'End time must be after the start time'
  } else if (startsAt && Date.parse(endsAtRaw) - Date.parse(startsAt) > MAX_DURATION_HOURS * 3_600_000) {
    fields.ends_at = `An event cannot run longer than ${MAX_DURATION_HOURS} hours`
  } else {
    endsAt = new Date(endsAtRaw).toISOString()
  }

  const location = typeof body.location === 'string' ? body.location.trim() : ''
  if (location.length < 1 || location.length > LOCATION_MAX) {
    fields.location = `Location is required (max ${LOCATION_MAX} characters)`
  }

  const capacity = body.capacity
  if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < 1 || capacity > CAPACITY_MAX) {
    fields.capacity = `Capacity must be an integer between 1 and ${CAPACITY_MAX}`
  }

  if (Object.keys(fields).length > 0) {
    throw new ApiError(400, 'validation_error', 'Invalid event input', fields)
  }

  return {
    title,
    game_type: gameType as GameType,
    starts_at: startsAt,
    ends_at: endsAt,
    location,
    capacity: capacity as number,
  }
}
