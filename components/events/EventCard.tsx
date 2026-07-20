import Link from 'next/link'
import { GAME_TYPE_LABELS, formatEventTime } from '@/lib/format'
import type { EventWithCount } from '@/lib/types'
import { SeatsBadge } from '@/components/ui/SeatsBadge'

export function EventCard({ event }: { event: EventWithCount }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-card transition hover:border-brand-500 hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{event.title}</h3>
        <SeatsBadge seatsLeft={event.seats_left} />
      </div>
      <p className="mt-2 text-sm text-slate-600">{formatEventTime(event.starts_at, event.ends_at)}</p>
      <p className="mt-1 text-sm text-slate-500">{event.location}</p>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-brand-600">
        {GAME_TYPE_LABELS[event.game_type]}
      </p>
    </Link>
  )
}
