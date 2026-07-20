import type { GameType } from '@/lib/types'

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  boardgame: 'Board game',
  tcg: 'TCG',
  rpg: 'RPG',
  miniatures: 'Miniatures',
  party: 'Party',
  other: 'Other',
}

// Locale is pinned so output doesn't vary by machine; timeZone is injectable
// so tests can assert exact strings regardless of where they run.
function formatter(options: Intl.DateTimeFormatOptions, timeZone?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', { ...options, ...(timeZone && { timeZone }) })
}

export function formatEventTime(startsAt: string, endsAt: string, timeZone?: string): string {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const dayOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }

  const day = formatter(dayOptions, timeZone).format(start)
  const startTime = formatter(timeOptions, timeZone).format(start)
  const sameDay = formatter(dayOptions, timeZone).format(end) === day
  const endPart = sameDay
    ? formatter(timeOptions, timeZone).format(end)
    : formatter({ ...dayOptions, ...timeOptions }, timeZone).format(end)

  return `${day}, ${startTime} – ${endPart}`
}

export function seatsLabel(seatsLeft: number): string {
  if (seatsLeft <= 0) return 'Full'
  if (seatsLeft === 1) return '1 seat left'
  return `${seatsLeft} seats left`
}

export function isInProgress(startsAt: string, endsAt: string, now: number = Date.now()): boolean {
  return Date.parse(startsAt) <= now && Date.parse(endsAt) > now
}
