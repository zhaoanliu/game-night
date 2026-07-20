import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth'
import { OrganizerDashboard } from '@/components/organizer/OrganizerDashboard'

export const metadata: Metadata = { title: 'Organizer — Game Night' }

export default async function OrganizerPage() {
  const user = await getCurrentUser()
  // Keyed by user so an identity switch remounts and refetches (see events/[id]).
  return <OrganizerDashboard key={user?.id} />
}
