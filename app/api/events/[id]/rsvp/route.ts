import { NextResponse } from 'next/server'
import { errorResponse, handleRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getEvent } from '@/lib/events'
import { rsvpResponseFor } from '@/lib/rsvp-status'
import { cancelRsvp, rsvpToEvent } from '@/lib/rsvp'

// Mutation responses carry the fresh counts so the pending-state UI can settle
// in a single round trip — no follow-up fetch, and the number shown after
// acting is the server's truth rather than a client-side guess.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const player = await requireUser('player')
    const { id } = await params

    const status = await rsvpToEvent(id, player.id)
    const outcome = rsvpResponseFor(status)

    if (outcome.error) return errorResponse(outcome.error)

    const event = await getEvent(id)
    return NextResponse.json(
      { status, attendee_count: event.attendee_count, seats_left: event.seats_left },
      { status: outcome.status }
    )
  })
}

// Idempotent for any existing event: cancelling a seat you don't hold is a
// no-op, not an error. An unknown event id is still a 404.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const player = await requireUser('player')
    const { id } = await params

    const status = await cancelRsvp(id, player.id)
    const event = await getEvent(id)

    return NextResponse.json({
      status,
      attendee_count: event.attendee_count,
      seats_left: event.seats_left,
    })
  })
}
