'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/client/api'
import type { User } from '@/lib/types'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'

// Full-screen gate: nothing renders behind it until an identity is picked.
// Picking POSTs the session cookie, then refreshes the server-rendered layout.
export function UserPicker() {
  const router = useRouter()
  const [users, setUsers] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setUsers(null)
    const result = await apiFetch<{ users: User[] }>('/api/users')
    if (result.ok) setUsers(result.data.users)
    else setError(result.message)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pick = async (userId: string) => {
    setPendingId(userId)
    const result = await apiFetch<{ user: User }>('/api/session', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
    if (result.ok) {
      router.refresh()
    } else {
      setError(result.message)
      setPendingId(null)
    }
  }

  const players = users?.filter((user) => user.role === 'player') ?? []
  const organizers = users?.filter((user) => user.role === 'organizer') ?? []

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">Game Night</h1>
      <p className="mt-2 text-slate-600">Community event board for tabletop gamers.</p>
      <h2 className="mt-8 text-xl font-semibold">Who are you?</h2>

      {error && <div className="mt-6"><ErrorState message={error} onRetry={load} /></div>}

      {!error && !users && (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!error && users && (
        <div className="mt-6 space-y-8">
          {[
            { heading: 'Players', group: players },
            { heading: 'Organizers', group: organizers },
          ].map(({ heading, group }) => (
            <section key={heading}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{heading}</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {group.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => pick(user.id)}
                      disabled={pendingId !== null}
                      className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-left text-sm shadow-card hover:border-brand-500 hover:shadow-card-hover disabled:opacity-50"
                    >
                      {pendingId === user.id ? 'Signing in…' : user.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
