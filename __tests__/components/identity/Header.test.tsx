import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '@/components/identity/Header'
import type { User } from '@/lib/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

const PLAYER: User = { id: 'p1', name: 'Yuki Tanaka', role: 'player' }
const ORGANIZER: User = { id: 'o1', name: 'Alice Chen', role: 'organizer' }

describe('Header', () => {
  it('shows player navigation and the current identity for players', () => {
    render(<Header user={PLAYER} />)

    expect(screen.getByRole('link', { name: 'My events' })).toHaveAttribute('href', '/my-events')
    expect(screen.queryByRole('link', { name: 'Organizer' })).not.toBeInTheDocument()
    expect(screen.getByText('Yuki Tanaka')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('shows organizer navigation for organizers', () => {
    render(<Header user={ORGANIZER} />)

    expect(screen.getByRole('link', { name: 'Organizer' })).toHaveAttribute('href', '/organizer')
    expect(screen.queryByRole('link', { name: 'My events' })).not.toBeInTheDocument()
  })

  it('offers no in-place identity switcher', () => {
    render(<Header user={PLAYER} />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
