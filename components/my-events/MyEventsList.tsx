'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/client/api'
import { formatEventTime } from '@/lib/format'
import type { CancelStatus, EventWithCount } from '@/lib/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'

type ListState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; events: EventWithCount[] }

// Upcoming only — history stays API-only for now (doc/decisions.md). The API
// returns soonest-first; this list preserves that order.
export function MyEventsList() {
  const [state, setState] = useState<ListState>({ phase: 'loading' })
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    const result = await apiFetch<{ events: EventWithCount[] }>('/api/my-events')
    if (result.ok) setState({ phase: 'ready', events: result.data.events })
    else setState({ phase: 'error', message: result.message })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cancel = async (eventId: string) => {
    setCancellingId(eventId)
    setError(null)
    const result = await apiFetch<{ status: CancelStatus }>(`/api/events/${eventId}/rsvp`, {
      method: 'DELETE',
    })
    if (result.ok) {
      setState((prev) =>
        prev.phase === 'ready'
          ? { phase: 'ready', events: prev.events.filter((event) => event.id !== eventId) }
          : prev
      )
    } else {
      setError(result.message)
    }
    setCancellingId(null)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">My events</h1>

      <div className="mt-6">
        {state.phase === 'loading' && (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {state.phase === 'error' && <ErrorState message={state.message} onRetry={load} />}

        {state.phase === 'ready' && state.events.length === 0 && (
          <EmptyState title="You haven't RSVP'd to any upcoming events" hint="Find one on the board.">
            <Link
              href="/"
              className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Browse events
            </Link>
          </EmptyState>
        )}

        {state.phase === 'ready' && state.events.length > 0 && (
          <>
            {error && (
              <p role="alert" className="mb-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}
            <ul className="space-y-3">
              {state.events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-card"
                >
                  <div>
                    <Link href={`/events/${event.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                      {event.title}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatEventTime(event.starts_at, event.ends_at)}
                    </p>
                    <p className="text-sm text-slate-500">{event.location}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => cancel(event.id)}
                    disabled={cancellingId !== null}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50"
                  >
                    {cancellingId === event.id && <Spinner />}
                    Cancel
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
