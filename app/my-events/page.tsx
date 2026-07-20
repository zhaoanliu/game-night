import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth'
import { MyEventsList } from '@/components/my-events/MyEventsList'

export const metadata: Metadata = { title: 'My events — Game Night' }

export default async function MyEventsPage() {
  const user = await getCurrentUser()
  // Keyed by user so an identity switch remounts and refetches (see events/[id]).
  return <MyEventsList key={user?.id} />
}
