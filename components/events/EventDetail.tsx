'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/client/api'
import { GAME_TYPE_LABELS, formatEventTime } from '@/lib/format'
import type { EventWithCount, Role } from '@/lib/types'
import { ErrorState } from '@/components/ui/ErrorState'
import { SeatsBadge } from '@/components/ui/SeatsBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AttendeeList } from '@/components/events/AttendeeList'
import { RsvpButton } from '@/components/events/RsvpButton'

type DetailState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; event: EventWithCount; myRsvp: boolean; isOwner: boolean }

export function EventDetail({ eventId, role }: { eventId: string; role: Role }) {
  const [state, setState] = useState<DetailState>({ phase: 'loading' })

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    const result = await apiFetch<{ event: EventWithCount; my_rsvp: boolean; is_owner: boolean }>(
      `/api/events/${eventId}`
    )
    if (result.ok) {
      setState({
        phase: 'ready',
        event: result.data.event,
        myRsvp: result.data.my_rsvp,
        isOwner: result.data.is_owner,
      })
    } else {
      setState({ phase: 'error', message: result.message })
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  if (state.phase === 'loading') {
    return (
      <div>
        <Skeleton className="h-8 w-96" />
        <Skeleton className="mt-4 h-4 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
    )
  }

  if (state.phase === 'error') {
    return <ErrorState message={state.message} onRetry={load} />
  }

  const { event, myRsvp, isOwner } = state

  return (
    <div>
      <Link href="/" className="text-sm text-brand-600 hover:text-brand-700">
        ← All events
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <SeatsBadge seatsLeft={event.seats_left} />
      </div>

      <dl className="mt-4 space-y-1 text-slate-600">
        <div>{formatEventTime(event.starts_at, event.ends_at)}</div>
        <div>{event.location}</div>
        <div className="text-sm uppercase tracking-wide text-brand-600">
          {GAME_TYPE_LABELS[event.game_type]}
        </div>
        <div className="text-sm">
          {event.attendee_count} of {event.capacity} seats taken
        </div>
      </dl>

      {role === 'player' && (
        <div className="mt-6">
          <RsvpButton
            eventId={event.id}
            myRsvp={myRsvp}
            onUpdate={(counts, updatedRsvp) =>
              setState({
                phase: 'ready',
                event: { ...event, ...counts },
                myRsvp: updatedRsvp,
                isOwner,
              })
            }
          />
        </div>
      )}

      {isOwner && <AttendeeList eventId={event.id} />}
    </div>
  )
}
