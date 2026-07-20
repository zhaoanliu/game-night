import { seatsLabel } from '@/lib/format'

// The two states a browsing player actually cares about get loud colors:
// nothing left, and almost nothing left.
export function SeatsBadge({ seatsLeft }: { seatsLeft: number }) {
  const tone =
    seatsLeft <= 0
      ? 'bg-red-100 text-red-800'
      : seatsLeft === 1
        ? 'bg-amber-100 text-amber-800'
        : 'bg-slate-100 text-slate-700'

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone}`}>
      {seatsLabel(seatsLeft)}
    </span>
  )
}
