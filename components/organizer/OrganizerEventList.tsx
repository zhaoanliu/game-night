'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/client/api'
import { formatEventTime, isInProgress } from '@/lib/format'
import type { EventWithCount } from '@/lib/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { SeatsBadge } from '@/components/ui/SeatsBadge'
import { CardSkeleton } from '@/components/ui/Skeleton'

type ListState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; events: EventWithCount[] }

// The endpoint's window is ends_at > now, so an in-progress event stays here —
// its roster is on the detail page exactly when the organizer needs it.
export function OrganizerEventList() {
  const [state, setState] = useState<ListState>({ phase: 'loading' })

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    const result = await apiFetch<{ events: EventWithCount[] }>('/api/organizer/events')
    if (result.ok) setState({ phase: 'ready', events: result.data.events })
    else setState({ phase: 'error', message: result.message })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section>
      <h2 className="text-lg font-semibold">Your events</h2>

      <div className="mt-4">
        {state.phase === 'loading' && (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {state.phase === 'error' && <ErrorState message={state.message} onRetry={load} />}

        {state.phase === 'ready' && state.events.length === 0 && (
          <EmptyState title="You haven't created any events yet" hint="Your events will appear here." />
        )}

        {state.phase === 'ready' && state.events.length > 0 && (
          <ul className="space-y-3">
            {state.events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-card"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/events/${event.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                      {event.title}
                    </Link>
                    {isInProgress(event.starts_at, event.ends_at) && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-green-800">
                        In progress
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatEventTime(event.starts_at, event.ends_at)}
                  </p>
                  <p className="text-sm text-slate-500">{event.location}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-600">
                    {event.attendee_count} / {event.capacity}
                  </span>
                  <SeatsBadge seatsLeft={event.seats_left} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
