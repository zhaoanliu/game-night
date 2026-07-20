'use client'

import { useState } from 'react'
import { CreateEventForm } from '@/components/organizer/CreateEventForm'
import { OrganizerEventList } from '@/components/organizer/OrganizerEventList'

// The list refetches by remount when the form creates an event — the two
// components stay independent and the data still comes from the server.
export function OrganizerDashboard() {
  const [listVersion, setListVersion] = useState(0)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Organizer</h1>
      <CreateEventForm onCreated={() => setListVersion((version) => version + 1)} />
      <OrganizerEventList key={listVersion} />
    </div>
  )
}
