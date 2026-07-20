import { getCurrentUser } from '@/lib/auth'
import { EventDetail } from '@/components/events/EventDetail'

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return null

  return <EventDetail eventId={id} role={user.role} />
}
