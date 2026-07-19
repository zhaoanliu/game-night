import { NextResponse } from 'next/server'
import { handleRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { listOrganizerEvents } from '@/lib/events'

export async function GET() {
  return handleRoute(async () => {
    const organizer = await requireUser('organizer')
    const events = await listOrganizerEvents(organizer.id)
    return NextResponse.json({ events })
  })
}
