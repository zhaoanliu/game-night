import Link from 'next/link'
import type { User } from '@/lib/types'
import { SignOutButton } from '@/components/identity/SignOutButton'

// Identity is sticky: no in-place switcher. Changing who you are means
// signing out, which routes every identity change through the picker and a
// full re-render — an open page can never show one user's data under
// another's session.
export function Header({ user }: { user: User }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <nav className="flex items-center gap-5">
          <Link href="/" className="text-lg font-bold text-slate-900">
            Game Night
          </Link>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">
            Browse
          </Link>
          {user.role === 'player' && (
            <Link href="/my-events" className="text-sm text-slate-600 hover:text-slate-900">
              My events
            </Link>
          )}
          {user.role === 'organizer' && (
            <Link href="/organizer" className="text-sm text-slate-600 hover:text-slate-900">
              Organizer
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">{user.name}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
