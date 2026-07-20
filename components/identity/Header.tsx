import Link from 'next/link'
import type { User } from '@/lib/types'
import { IdentitySwitcher } from '@/components/identity/IdentitySwitcher'

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
        <IdentitySwitcher current={user} />
      </div>
    </header>
  )
}
