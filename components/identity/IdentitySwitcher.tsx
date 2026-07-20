'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/client/api'
import type { User } from '@/lib/types'

// Demo affordance for a two-role product: swap identity without hunting for a
// sign-out flow. The server still re-resolves the cookie on every request.
export function IdentitySwitcher({ current }: { current: User }) {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void apiFetch<{ users: User[] }>('/api/users').then((result) => {
      if (!cancelled && result.ok) setUsers(result.data.users)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const switchTo = async (userId: string) => {
    if (userId === current.id) return
    setBusy(true)
    const result = await apiFetch<{ user: User }>('/api/session', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
    if (result.ok) router.refresh()
    setBusy(false)
  }

  const signOut = async () => {
    setBusy(true)
    await apiFetch<{ user: null }>('/api/session', { method: 'DELETE' })
    router.refresh()
    setBusy(false)
  }

  const players = users.filter((user) => user.role === 'player')
  const organizers = users.filter((user) => user.role === 'organizer')

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Switch user"
        value={current.id}
        disabled={busy}
        onChange={(event) => switchTo(event.target.value)}
        className="max-w-48 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
      >
        {users.length === 0 && <option value={current.id}>{current.name}</option>}
        {players.length > 0 && (
          <optgroup label="Players">
            {players.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </optgroup>
        )}
        {organizers.length > 0 && (
          <optgroup label="Organizers">
            {organizers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="rounded-md px-2 py-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        Sign out
      </button>
    </div>
  )
}
