import { NextResponse } from 'next/server'
import { handleRoute } from '@/lib/api'
import { requireUser } from '@/lib/auth'
import { listPlayerEvents } from '@/lib/events'

export async function GET() {
  return handleRoute(async () => {
    const player = await requireUser('player')
    const events = await listPlayerEvents(player.id)
    return NextResponse.json({ events })
  })
}
