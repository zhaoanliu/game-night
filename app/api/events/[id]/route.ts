import { NextResponse } from 'next/server'
import { handleRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getEvent, hasRsvp } from '@/lib/events'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const user = await requireUser()
    const { id } = await params

    const event = await getEvent(id)
    const myRsvp = user.role === 'player' ? await hasRsvp(id, user.id) : false

    return NextResponse.json({
      event,
      my_rsvp: myRsvp,
      is_owner: event.organizer_id === user.id,
    })
  })
}
