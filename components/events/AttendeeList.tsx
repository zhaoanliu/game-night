'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/client/api'
import type { Attendee } from '@/lib/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'

type RosterState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; attendees: Attendee[] }

// Only rendered for the owning organizer; the server still checks ownership
// on every request, so a non-owner reaching this fetch gets the 403 envelope.
export function AttendeeList({ eventId }: { eventId: string }) {
  const [state, setState] = useState<RosterState>({ phase: 'loading' })

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    const result = await apiFetch<{ attendees: Attendee[] }>(`/api/events/${eventId}/attendees`)
    if (result.ok) setState({ phase: 'ready', attendees: result.data.attendees })
    else setState({ phase: 'error', message: result.message })
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">
        Attendees{state.phase === 'ready' ? ` (${state.attendees.length})` : ''}
      </h2>

      {state.phase === 'loading' && (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-56" />
        </div>
      )}

      {state.phase === 'error' && (
        <div className="mt-3">
          <ErrorState message={state.message} onRetry={load} />
        </div>
      )}

      {state.phase === 'ready' && state.attendees.length === 0 && (
        <div className="mt-3">
          <EmptyState title="No one has RSVP'd yet" />
        </div>
      )}

      {state.phase === 'ready' && state.attendees.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {state.attendees.map((attendee) => (
            <li key={attendee.id} className="px-4 py-2.5 text-sm text-slate-700">
              {attendee.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
