import { NextResponse } from 'next/server'
import { ApiError, handleRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { listUpcomingEvents } from '@/lib/events'
import { createServiceClient } from '@/lib/supabase/service'
import { parseGameType, validateEventInput } from '@/lib/validation'

export async function GET(request: Request) {
  return handleRoute(async () => {
    await requireUser()

    const params = new URL(request.url).searchParams
    const events = await listUpcomingEvents({
      search: params.get('q'),
      gameType: parseGameType(params.get('game_type')),
    })

    return NextResponse.json({ events })
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const organizer = await requireUser('organizer')

    const body = await request.json().catch(() => null)
    const input = validateEventInput(body)

    const supabase = createServiceClient()
    // organizer_id comes from the session, never from the request body.
    const { data, error } = await supabase
      .from('events')
      .insert({ ...input, organizer_id: organizer.id })
      .select('id, organizer_id, title, game_type, starts_at, location, capacity, created_at, updated_at')
      .single()

    if (error) {
      console.error('create event failed:', error.message, error)
      throw new ApiError(500, 'internal_error', 'Could not create the event')
    }

    return NextResponse.json(
      { event: { ...data, attendee_count: 0, seats_left: data.capacity } },
      { status: 201 }
    )
  })
}
