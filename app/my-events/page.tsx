import type { Metadata } from 'next'
import { MyEventsList } from '@/components/my-events/MyEventsList'

export const metadata: Metadata = { title: 'My events — Game Night' }

export default function MyEventsPage() {
  return <MyEventsList />
}
