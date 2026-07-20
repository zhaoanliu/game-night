import type { Metadata } from 'next'
import { OrganizerDashboard } from '@/components/organizer/OrganizerDashboard'

export const metadata: Metadata = { title: 'Organizer — Game Night' }

export default function OrganizerPage() {
  return <OrganizerDashboard />
}
