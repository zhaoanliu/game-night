import { NextResponse } from 'next/server'
import { handleRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { listPlayerEvents } from '@/lib/events'
import { parseEventWindow } from '@/lib/validation'

export async function GET(request: Request) {
  return handleRoute(async () => {
    const player = await requireUser('player')

    const when = parseEventWindow(new URL(request.url).searchParams.get('when'))
    const events = await listPlayerEvents(player.id, when)

    // Echoing the window back keeps the client honest about which tab it is
    // rendering, rather than inferring it from the request it made.
    return NextResponse.json({ events, when })
  })
}
