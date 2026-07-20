'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/client/api'
import type { Role, User } from '@/lib/types'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'

// Where to land after sign-in. A deep link the role can use is preserved
// (the gate covers every path); a generic entry or a page the role would
// only 403 on routes to the role's home instead.
function landingPath(role: Role, currentPath: string): string | null {
  if (role === 'organizer' && (currentPath === '/' || currentPath.startsWith('/my-events'))) {
    return '/organizer'
  }
  if (role === 'player' && currentPath.startsWith('/organizer')) {
    return '/'
  }
  return null
}

// The login page, minus the password (none exists — see doc/decisions.md on
// identity): pick anyone, player or organizer, from one dropdown and sign in.
export function UserPicker() {
  const router = useRouter()
  const pathname = usePathname()
  const [users, setUsers] = useState<User[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [signInError, setSignInError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    setUsers(null)
    const result = await apiFetch<{ users: User[] }>('/api/users')
    if (result.ok) setUsers(result.data.users)
    else setLoadError(result.message)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const signIn = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedId) return
    setBusy(true)
    setSignInError(null)
    const result = await apiFetch<{ user: User }>('/api/session', {
      method: 'POST',
      body: JSON.stringify({ userId: selectedId }),
    })
    if (result.ok) {
      const target = landingPath(result.data.user.role, pathname)
      if (target) router.push(target)
      router.refresh()
    } else {
      setSignInError(result.message)
      setBusy(false)
    }
  }

  const players = users?.filter((user) => user.role === 'player') ?? []
  const organizers = users?.filter((user) => user.role === 'organizer') ?? []

  return (
    <main className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-card">
        <h1 className="text-2xl font-bold">Game Night</h1>
        <p className="mt-1 text-sm text-slate-600">Community event board for tabletop gamers.</p>
        <h2 className="mt-6 text-base font-semibold">Who are you?</h2>

        {loadError && (
          <div className="mt-4">
            <ErrorState message={loadError} onRetry={load} />
          </div>
        )}

        {!loadError && !users && <Skeleton className="mt-4 h-10 w-full" />}

        {!loadError && users && (
          <form onSubmit={signIn} className="mt-4">
            <label htmlFor="login-user" className="block text-sm font-medium text-slate-700">
              User
            </label>
            <select
              id="login-user"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Select a user…
              </option>
              <optgroup label="Players">
                {players.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Organizers">
                {organizers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </optgroup>
            </select>

            {signInError && (
              <p role="alert" className="mt-2 text-sm font-medium text-red-700">
                {signInError}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || selectedId === ''}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy && <Spinner />}
              Sign in
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
