import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdentitySwitcher } from '@/components/identity/IdentitySwitcher'
import { jsonResponse, stubFetch } from '../../helpers/http'
import type { User } from '@/lib/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}))

const YUKI: User = { id: 'p1', name: 'Yuki Tanaka', role: 'player' }
const USERS = [YUKI, { id: 'o1', name: 'Alice Chen', role: 'organizer' }]

afterEach(() => {
  vi.unstubAllGlobals()
  refresh.mockClear()
})

describe('IdentitySwitcher', () => {
  it('lists all users with the current one selected', async () => {
    stubFetch().mockResolvedValue(jsonResponse({ users: USERS }))
    render(<IdentitySwitcher current={YUKI} />)

    const select = screen.getByRole('combobox', { name: 'Switch user' })
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
    expect((select as HTMLSelectElement).value).toBe('p1')
  })

  it('posts the new identity and refreshes on switch', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ users: USERS }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: USERS[1] }))
    render(<IdentitySwitcher current={YUKI} />)

    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Switch user' }), 'o1')

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toBe('/api/session')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ userId: 'o1' })
  })

  it('clears the session and refreshes on sign out', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ users: USERS }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: null }))
    render(<IdentitySwitcher current={YUKI} />)

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toBe('/api/session')
    expect((init as RequestInit).method).toBe('DELETE')
  })
})
