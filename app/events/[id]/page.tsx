import { getCurrentUser } from '@/lib/auth'
import { EventDetail } from '@/components/events/EventDetail'

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return null

  // Keyed by user: the identity switcher's router.refresh() re-renders this
  // shell with the new cookie, and the key change remounts the client tree so
  // my_rsvp / is_owner are refetched for the new identity.
  return <EventDetail key={user.id} eventId={id} role={user.role} />
}
