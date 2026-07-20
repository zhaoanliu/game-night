'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/client/api'
import { GAME_TYPE_LABELS } from '@/lib/format'
import { GAME_TYPES, type EventWithCount, type GameType } from '@/lib/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { CardSkeleton } from '@/components/ui/Skeleton'
import { EventCard } from '@/components/events/EventCard'

type ListState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; events: EventWithCount[] }

const SEARCH_DEBOUNCE_MS = 250

export function EventList() {
  const [query, setQuery] = useState('')
  const [gameType, setGameType] = useState<GameType | ''>('')
  const [state, setState] = useState<ListState>({ phase: 'loading' })
  const firstLoad = useRef(true)

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (gameType) params.set('game_type', gameType)
    const suffix = params.size > 0 ? `?${params}` : ''

    const result = await apiFetch<{ events: EventWithCount[] }>(`/api/events${suffix}`)
    if (result.ok) setState({ phase: 'ready', events: result.data.events })
    else setState({ phase: 'error', message: result.message })
  }, [query, gameType])

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false
      void load()
      return
    }
    const timer = setTimeout(() => void load(), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [load])

  const filtered = query !== '' || gameType !== ''

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Upcoming events</h1>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by title or location"
          aria-label="Search events"
          className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by game type">
        <FilterChip label="All" active={gameType === ''} onClick={() => setGameType('')} />
        {GAME_TYPES.map((type) => (
          <FilterChip
            key={type}
            label={GAME_TYPE_LABELS[type]}
            active={gameType === type}
            onClick={() => setGameType(type)}
          />
        ))}
      </div>

      <div className="mt-6">
        {state.phase === 'loading' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {state.phase === 'error' && <ErrorState message={state.message} onRetry={load} />}

        {state.phase === 'ready' && state.events.length === 0 && (
          <EmptyState
            title={filtered ? 'No events match your search' : 'No upcoming events'}
            hint={filtered ? 'Try a different search or filter.' : 'Check back soon.'}
          />
        )}

        {state.phase === 'ready' && state.events.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
        active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 shadow-card hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  )
}
