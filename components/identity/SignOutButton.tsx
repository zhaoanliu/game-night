'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/client/api'

export function SignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    setBusy(true)
    await apiFetch<{ user: null }>('/api/session', { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="rounded-md px-2 py-1.5 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-50"
    >
      Sign out
    </button>
  )
}
