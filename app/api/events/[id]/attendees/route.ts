import { NextResponse } from 'next/server'
import { ApiError, handleRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { getEvent } from '@/lib/events'
import { createServiceClient } from '@/lib/supabase/service'

// An organizer sees the attendee list for their own events only. Ownership is
// checked against the session, so one organizer cannot read another's roster.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const organizer = await requireUser('organizer')
    const { id } = await params

    const event = await getEvent(id)
    if (event.organizer_id !== organizer.id) {
      throw new ApiError(403, 'not_owner', 'You can only see attendees for your own events')
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('rsvps')
      .select('created_at, users!inner(id, name)')
      .eq('event_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('list attendees failed:', error.message, error)
      throw new ApiError(500, 'internal_error', 'Could not load attendees')
    }

    const attendees = (data ?? []).map((row) => {
      const user = row.users as unknown as { id: string; name: string }
      return { id: user.id, name: user.name, created_at: row.created_at as string }
    })

    return NextResponse.json({ event, attendees })
  })
}
