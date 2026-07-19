import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { asUser, cleanup, countRsvps, createEvent, createUser, createUsers } from './helpers'

// The proof that S1 and S2 hold, exercised the way a real client hits them:
// concurrent HTTP requests against a production build of the server. Testing
// the SQL function directly would prove less — the brief asks that the *API*
// enforce capacity, so the session, role check, and route handler are all in
// the path here.

let organizer: { id: string }

beforeAll(async () => {
  await cleanup()
  organizer = await createUser('organizer')
})

afterAll(async () => {
  await cleanup()
})

describe('S1 — an event never exceeds capacity', () => {
  it('seats exactly capacity when 20 players race for 5 seats', async () => {
    const event = await createEvent({ organizerId: organizer.id, capacity: 5 })
    const players = await createUsers('player', 20)

    const responses = await Promise.all(
      players.map((player) => asUser(player, `/api/events/${event.id}/rsvp`, { method: 'POST' }))
    )

    const confirmed = responses.filter((r) => r.status === 201)
    const full = responses.filter((r) => r.status === 409)

    expect(confirmed).toHaveLength(5)
    expect(full).toHaveLength(15)
    expect(responses.filter((r) => r.status !== 201 && r.status !== 409)).toEqual([])

    // The database is the real assertion: the API could lie, the rows cannot.
    await expect(countRsvps(event.id)).resolves.toBe(5)
  })

  it('holds when the race is for a single remaining seat', async () => {
    const event = await createEvent({ organizerId: organizer.id, capacity: 1 })
    const players = await createUsers('player', 10)

    const responses = await Promise.all(
      players.map((player) => asUser(player, `/api/events/${event.id}/rsvp`, { method: 'POST' }))
    )

    expect(responses.filter((r) => r.status === 201)).toHaveLength(1)
    expect(responses.filter((r) => r.status === 409)).toHaveLength(9)
    await expect(countRsvps(event.id)).resolves.toBe(1)
  })
})

describe('S2 — one active RSVP per player, retries included', () => {
  it('counts a seat once when the same player submits 10 times in parallel', async () => {
    const event = await createEvent({ organizerId: organizer.id, capacity: 5 })
    const player = await createUser('player')

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        asUser(player, `/api/events/${event.id}/rsvp`, { method: 'POST' })
      )
    )

    // Exactly one request created the seat; the rest are idempotent successes.
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1)
    expect(responses.filter((r) => r.status === 200)).toHaveLength(9)
    expect(
      responses.filter((r) => (r.body as { status: string }).status === 'already_rsvpd')
    ).toHaveLength(9)

    await expect(countRsvps(event.id)).resolves.toBe(1)
  })

  it('reports already_rsvpd rather than event_full when a seat-holder retries on a full event', async () => {
    const event = await createEvent({ organizerId: organizer.id, capacity: 2 })
    const [first, second] = await createUsers('player', 2)

    await asUser(first, `/api/events/${event.id}/rsvp`, { method: 'POST' })
    await asUser(second, `/api/events/${event.id}/rsvp`, { method: 'POST' })

    // The event is now full, but this player already holds a seat: a retry
    // must read as success, not as a conflict.
    const retry = await asUser<{ status: string }>(first, `/api/events/${event.id}/rsvp`, {
      method: 'POST',
    })

    expect(retry.status).toBe(200)
    expect(retry.body.status).toBe('already_rsvpd')
    await expect(countRsvps(event.id)).resolves.toBe(2)
  })
})

describe('cancelling frees the seat', () => {
  it('lets exactly one of two waiting players take a cancelled seat', async () => {
    const event = await createEvent({ organizerId: organizer.id, capacity: 1 })
    const holder = await createUser('player')
    const waiting = await createUsers('player', 2)

    await asUser(holder, `/api/events/${event.id}/rsvp`, { method: 'POST' })
    await expect(
      asUser(waiting[0], `/api/events/${event.id}/rsvp`, { method: 'POST' })
    ).resolves.toMatchObject({ status: 409 })

    const cancelled = await asUser<{ status: string }>(holder, `/api/events/${event.id}/rsvp`, {
      method: 'DELETE',
    })
    expect(cancelled.body.status).toBe('cancelled')
    await expect(countRsvps(event.id)).resolves.toBe(0)

    const race = await Promise.all(
      waiting.map((player) => asUser(player, `/api/events/${event.id}/rsvp`, { method: 'POST' }))
    )

    expect(race.filter((r) => r.status === 201)).toHaveLength(1)
    expect(race.filter((r) => r.status === 409)).toHaveLength(1)
    await expect(countRsvps(event.id)).resolves.toBe(1)
  })

  it('is idempotent — cancelling a seat you do not hold is not an error', async () => {
    const event = await createEvent({ organizerId: organizer.id, capacity: 3 })
    const player = await createUser('player')

    const first = await asUser<{ status: string }>(player, `/api/events/${event.id}/rsvp`, {
      method: 'DELETE',
    })
    expect(first.status).toBe(200)
    expect(first.body.status).toBe('not_rsvpd')

    await asUser(player, `/api/events/${event.id}/rsvp`, { method: 'POST' })
    await asUser(player, `/api/events/${event.id}/rsvp`, { method: 'DELETE' })

    const again = await asUser<{ status: string }>(player, `/api/events/${event.id}/rsvp`, {
      method: 'DELETE',
    })
    expect(again.body.status).toBe('not_rsvpd')
  })

  it('allows re-claiming a seat after cancelling', async () => {
    const event = await createEvent({ organizerId: organizer.id, capacity: 2 })
    const player = await createUser('player')

    await asUser(player, `/api/events/${event.id}/rsvp`, { method: 'POST' })
    await asUser(player, `/api/events/${event.id}/rsvp`, { method: 'DELETE' })

    const again = await asUser<{ status: string }>(player, `/api/events/${event.id}/rsvp`, {
      method: 'POST',
    })

    expect(again.status).toBe(201)
    expect(again.body.status).toBe('confirmed')
    await expect(countRsvps(event.id)).resolves.toBe(1)
  })
})
