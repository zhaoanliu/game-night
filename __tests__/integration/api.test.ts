import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { asUser, cleanup, createEvent, createUser, createUsers, serviceClient } from './helpers'

// Authorization and server-side validation (S4), plus the seed contract the
// demo depends on.

let organizer: { id: string }
let otherOrganizer: { id: string }
let player: { id: string }

beforeAll(async () => {
  await cleanup()
  ;[organizer, otherOrganizer] = await createUsers('organizer', 2)
  player = await createUser('player')
})

afterAll(async () => {
  await cleanup()
})

const validEvent = () => ({
  title: 'Integration draft night',
  game_type: 'tcg',
  starts_at: new Date(Date.now() + 86_400_000).toISOString(),
  location: 'Test hall',
  capacity: 8,
})

describe('identity is required and enforced by the server', () => {
  it('rejects an anonymous request', async () => {
    const response = await asUser<{ error: { code: string } }>(null, '/api/events')
    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('not_identified')
  })

  it('rejects an unknown user id in the cookie', async () => {
    const ghost = { id: '00000000-0000-0000-0000-000000000000' }
    const response = await asUser(ghost, '/api/events')
    expect(response.status).toBe(401)
  })

  it('rejects a malformed user id without erroring', async () => {
    const response = await asUser({ id: 'not-a-uuid' }, '/api/events')
    expect(response.status).toBe(401)
  })
})

describe('roles decide what each user may do', () => {
  it('refuses event creation by a player', async () => {
    const response = await asUser<{ error: { code: string } }>(player, '/api/events', {
      method: 'POST',
      body: JSON.stringify(validEvent()),
    })
    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('forbidden')
  })

  it('refuses an RSVP by an organizer', async () => {
    const event = await createEvent({ organizerId: organizer.id, capacity: 4 })
    const response = await asUser(organizer, `/api/events/${event.id}/rsvp`, { method: 'POST' })
    expect(response.status).toBe(403)
  })

  it('refuses my-events for an organizer', async () => {
    const response = await asUser(organizer, '/api/my-events')
    expect(response.status).toBe(403)
  })

  it('lets an organizer read their own attendee list but not another organizer\'s', async () => {
    const event = await createEvent({ organizerId: organizer.id, capacity: 4 })
    await asUser(player, `/api/events/${event.id}/rsvp`, { method: 'POST' })

    const own = await asUser<{ attendees: { id: string; name: string }[] }>(
      organizer,
      `/api/events/${event.id}/attendees`
    )
    expect(own.status).toBe(200)
    expect(own.body.attendees).toHaveLength(1)
    expect(own.body.attendees[0].id).toBe(player.id)

    const other = await asUser<{ error: { code: string } }>(
      otherOrganizer,
      `/api/events/${event.id}/attendees`
    )
    expect(other.status).toBe(403)
    expect(other.body.error.code).toBe('not_owner')
  })
})

describe('S4 — invalid input is rejected server-side with clear errors', () => {
  const cases: [string, Record<string, unknown>, string][] = [
    ['capacity of zero', { capacity: 0 }, 'capacity'],
    ['negative capacity', { capacity: -3 }, 'capacity'],
    ['fractional capacity', { capacity: 2.5 }, 'capacity'],
    ['capacity as a string', { capacity: '8' }, 'capacity'],
    ['a start time in the past', { starts_at: new Date(Date.now() - 60_000).toISOString() }, 'starts_at'],
    ['an unparseable start time', { starts_at: 'next tuesday' }, 'starts_at'],
    ['an unknown game type', { game_type: 'chess' }, 'game_type'],
    ['an empty title', { title: '   ' }, 'title'],
    ['an empty location', { location: '' }, 'location'],
  ]

  it.each(cases)('rejects %s', async (_label, override, field) => {
    const response = await asUser<{ error: { code: string; fields: Record<string, string> } }>(
      organizer,
      '/api/events',
      { method: 'POST', body: JSON.stringify({ ...validEvent(), ...override }) }
    )

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('validation_error')
    expect(response.body.error.fields).toHaveProperty(field)
  })

  it('reports every invalid field at once', async () => {
    const response = await asUser<{ error: { fields: Record<string, string> } }>(
      organizer,
      '/api/events',
      {
        method: 'POST',
        body: JSON.stringify({ title: '', game_type: 'chess', starts_at: 'no', location: '', capacity: 0 }),
      }
    )

    expect(Object.keys(response.body.error.fields).sort()).toEqual([
      'capacity',
      'game_type',
      'location',
      'starts_at',
      'title',
    ])
  })

  it('rejects an unknown event id with 404, not a 500', async () => {
    const response = await asUser<{ error: { code: string } }>(
      player,
      '/api/events/00000000-0000-0000-0000-000000000000/rsvp',
      { method: 'POST' }
    )
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('event_not_found')
  })

  it('refuses an RSVP to an event that has already started', async () => {
    const past = await createEvent({
      organizerId: organizer.id,
      capacity: 5,
      startsAt: new Date(Date.now() - 86_400_000),
    })

    const response = await asUser<{ error: { code: string } }>(
      player,
      `/api/events/${past.id}/rsvp`,
      { method: 'POST' }
    )
    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe('event_started')
  })

  it('rejects an unknown game type filter', async () => {
    const response = await asUser<{ error: { code: string } }>(player, '/api/events?game_type=chess')
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('invalid_game_type')
  })
})

describe('event listing', () => {
  it('returns upcoming events soonest first and excludes past ones', async () => {
    const soon = await createEvent({
      organizerId: organizer.id,
      capacity: 5,
      startsAt: new Date(Date.now() + 3_600_000),
      title: 'itest:sorting-soon',
    })
    const later = await createEvent({
      organizerId: organizer.id,
      capacity: 5,
      startsAt: new Date(Date.now() + 7_200_000),
      title: 'itest:sorting-later',
    })
    const past = await createEvent({
      organizerId: organizer.id,
      capacity: 5,
      startsAt: new Date(Date.now() - 3_600_000),
      title: 'itest:sorting-past',
    })

    const { body } = await asUser<{ events: { id: string; starts_at: string }[] }>(
      player,
      '/api/events'
    )
    const ids = body.events.map((e) => e.id)

    expect(ids).toContain(soon.id)
    expect(ids).toContain(later.id)
    expect(ids).not.toContain(past.id)
    expect(ids.indexOf(soon.id)).toBeLessThan(ids.indexOf(later.id))

    const times = body.events.map((e) => Date.parse(e.starts_at))
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('reports seats left and reflects an RSVP in the count', async () => {
    const event = await createEvent({ organizerId: organizer.id, capacity: 3 })

    const before = await asUser<{ event: { attendee_count: number; seats_left: number } }>(
      player,
      `/api/events/${event.id}`
    )
    expect(before.body.event.attendee_count).toBe(0)
    expect(before.body.event.seats_left).toBe(3)

    await asUser(player, `/api/events/${event.id}/rsvp`, { method: 'POST' })

    const after = await asUser<{
      event: { attendee_count: number; seats_left: number }
      my_rsvp: boolean
    }>(player, `/api/events/${event.id}`)
    expect(after.body.event.attendee_count).toBe(1)
    expect(after.body.event.seats_left).toBe(2)
    expect(after.body.my_rsvp).toBe(true)
  })

  it('filters by game type and by free text', async () => {
    await createEvent({ organizerId: organizer.id, capacity: 5, title: 'itest:findme-unique-title' })

    const byText = await asUser<{ events: { title: string }[] }>(
      player,
      '/api/events?q=findme-unique'
    )
    expect(byText.body.events).toHaveLength(1)

    const byType = await asUser<{ events: { game_type: string }[] }>(
      player,
      '/api/events?game_type=other'
    )
    expect(byType.body.events.every((e) => e.game_type === 'other')).toBe(true)
  })
})

describe('my events', () => {
  it('lists only the events this player holds a seat at, soonest first', async () => {
    const mine = await createEvent({
      organizerId: organizer.id,
      capacity: 5,
      startsAt: new Date(Date.now() + 3_600_000),
    })
    const alsoMine = await createEvent({
      organizerId: organizer.id,
      capacity: 5,
      startsAt: new Date(Date.now() + 7_200_000),
    })
    const notMine = await createEvent({ organizerId: organizer.id, capacity: 5 })

    const solo = await createUser('player')
    await asUser(solo, `/api/events/${alsoMine.id}/rsvp`, { method: 'POST' })
    await asUser(solo, `/api/events/${mine.id}/rsvp`, { method: 'POST' })

    const { body } = await asUser<{ events: { id: string }[] }>(solo, '/api/my-events')
    expect(body.events.map((e) => e.id)).toEqual([mine.id, alsoMine.id])
    expect(body.events.map((e) => e.id)).not.toContain(notMine.id)
  })

  it('is empty for a player who has not RSVPd', async () => {
    const newcomer = await createUser('player')
    const { body } = await asUser<{ events: unknown[] }>(newcomer, '/api/my-events')
    expect(body.events).toEqual([])
  })
})

describe('the seed keeps its promises', () => {
  it('offers a full event, near-full events, an empty one, and a past one', async () => {
    const { data, error } = await serviceClient()
      .from('events_with_counts')
      .select('title, capacity, attendee_count, starts_at')
      .not('title', 'like', 'itest:%')

    expect(error).toBeNull()
    const events = data as { capacity: number; attendee_count: number; starts_at: string }[]
    const upcoming = events.filter((e) => Date.parse(e.starts_at) > Date.now())

    expect(upcoming.filter((e) => e.attendee_count >= e.capacity)).toHaveLength(1)
    expect(
      upcoming.filter((e) => e.capacity - e.attendee_count === 1).length
    ).toBeGreaterThanOrEqual(2)
    expect(upcoming.some((e) => e.attendee_count === 0)).toBe(true)
    expect(events.some((e) => Date.parse(e.starts_at) < Date.now())).toBe(true)
  })
})
