'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/client/api'
import type { CancelStatus, RsvpStatus } from '@/lib/types'
import { Spinner } from '@/components/ui/Spinner'

interface RsvpCounts {
  attendee_count: number
  seats_left: number
}

interface RsvpButtonProps {
  eventId: string
  myRsvp: boolean
  onUpdate: (counts: RsvpCounts, myRsvp: boolean) => void
}

// Pending, never optimistic: the seat count is shared state being mutated by
// strangers, so the button waits for the server's answer and settles from the
// mutation response. On a rejection (full / started) the response is an error
// envelope with no counts, so the fresh number comes from one refetch.
export function RsvpButton({ eventId, myRsvp, onUpdate }: RsvpButtonProps) {
  const [pending, setPending] = useState<'rsvp' | 'cancel' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refreshCounts = async () => {
    const result = await apiFetch<{ event: RsvpCounts; my_rsvp: boolean }>(`/api/events/${eventId}`)
    if (result.ok) {
      onUpdate(
        { attendee_count: result.data.event.attendee_count, seats_left: result.data.event.seats_left },
        result.data.my_rsvp
      )
    }
  }

  const rsvp = async () => {
    setPending('rsvp')
    setNotice(null)
    const result = await apiFetch<RsvpCounts & { status: RsvpStatus }>(`/api/events/${eventId}/rsvp`, {
      method: 'POST',
    })

    if (result.ok) {
      onUpdate({ attendee_count: result.data.attendee_count, seats_left: result.data.seats_left }, true)
      setNotice("You're in!")
    } else if (result.code === 'event_full') {
      setNotice('Event is full')
      await refreshCounts()
    } else if (result.code === 'event_started') {
      setNotice('This event has already started')
      await refreshCounts()
    } else {
      setNotice(result.message)
    }
    setPending(null)
  }

  const cancel = async () => {
    setPending('cancel')
    setNotice(null)
    const result = await apiFetch<RsvpCounts & { status: CancelStatus }>(`/api/events/${eventId}/rsvp`, {
      method: 'DELETE',
    })

    if (result.ok) {
      onUpdate({ attendee_count: result.data.attendee_count, seats_left: result.data.seats_left }, false)
      setNotice('Your seat has been released')
    } else {
      setNotice(result.message)
    }
    setPending(null)
  }

  return (
    <div>
      {myRsvp ? (
        <div className="flex items-center gap-3">
          <span className="font-medium text-green-700">You&apos;re in ✓</span>
          <button
            type="button"
            onClick={cancel}
            disabled={pending !== null}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50"
          >
            {pending === 'cancel' && <Spinner />}
            Cancel RSVP
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={rsvp}
          disabled={pending !== null}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-5 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending === 'rsvp' && <Spinner />}
          RSVP
        </button>
      )}
      <p role="status" className="mt-2 min-h-5 text-sm font-medium text-slate-700">
        {pending === 'rsvp' ? 'Reserving…' : pending === 'cancel' ? 'Cancelling…' : notice}
      </p>
    </div>
  )
}
