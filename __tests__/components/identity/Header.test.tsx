import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from '@/components/identity/Header'
import { jsonResponse, stubFetch } from '../../helpers/http'
import type { User } from '@/lib/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

const PLAYER: User = { id: 'p1', name: 'Yuki Tanaka', role: 'player' }
const ORGANIZER: User = { id: 'o1', name: 'Alice Chen', role: 'organizer' }

describe('Header', () => {
  it('shows player navigation for players', () => {
    stubFetch().mockResolvedValue(jsonResponse({ users: [] }))
    render(<Header user={PLAYER} />)

    expect(screen.getByRole('link', { name: 'My events' })).toHaveAttribute('href', '/my-events')
    expect(screen.queryByRole('link', { name: 'Organizer' })).not.toBeInTheDocument()
  })

  it('shows organizer navigation for organizers', () => {
    stubFetch().mockResolvedValue(jsonResponse({ users: [] }))
    render(<Header user={ORGANIZER} />)

    expect(screen.getByRole('link', { name: 'Organizer' })).toHaveAttribute('href', '/organizer')
    expect(screen.queryByRole('link', { name: 'My events' })).not.toBeInTheDocument()
  })
})
