import { NextResponse } from 'next/server'
import { errorResponse, handleRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { rsvpResponseFor } from '@/lib/rsvp-status'
import { cancelRsvp, rsvpToEvent } from '@/lib/rsvp'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const player = await requireUser('player')
    const { id } = await params

    const status = await rsvpToEvent(id, player.id)
    const outcome = rsvpResponseFor(status)

    if (outcome.error) return errorResponse(outcome.error)
    return NextResponse.json({ status }, { status: outcome.status })
  })
}

// Idempotent: cancelling a seat you don't hold is a no-op, not an error.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const player = await requireUser('player')
    const { id } = await params

    const status = await cancelRsvp(id, player.id)
    return NextResponse.json({ status })
  })
}
