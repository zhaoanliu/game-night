import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserPicker } from '@/components/identity/UserPicker'
import { errorEnvelope, jsonResponse, stubFetch } from '../../helpers/http'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}))

const USERS = [
  { id: 'p1', name: 'Yuki Tanaka', role: 'player' },
  { id: 'o1', name: 'Alice Chen', role: 'organizer' },
]

afterEach(() => {
  vi.unstubAllGlobals()
  refresh.mockClear()
})

describe('UserPicker', () => {
  it('lists players and organizers in one dropdown, grouped', async () => {
    stubFetch().mockResolvedValue(jsonResponse({ users: USERS }))
    render(<UserPicker />)

    const select = await screen.findByRole('combobox', { name: 'User' })
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Players' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Organizers' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Yuki Tanaka' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Alice Chen' })).toBeInTheDocument()
  })

  it('keeps Sign in disabled until a user is chosen, then posts and refreshes', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ users: USERS }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: USERS[0] }))
    render(<UserPicker />)

    const button = await screen.findByRole('button', { name: 'Sign in' })
    expect(button).toBeDisabled()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'User' }), 'p1')
    expect(button).toBeEnabled()
    await userEvent.click(button)

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toBe('/api/session')
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ userId: 'p1' })
  })

  it('shows an error state with retry when the roster fails to load', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(errorEnvelope('internal_error', 'Could not load users', 500))
    fetchMock.mockResolvedValueOnce(jsonResponse({ users: USERS }))
    render(<UserPicker />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load users')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('combobox', { name: 'User' })).toBeInTheDocument()
  })

  it('surfaces a failed sign-in inline without refreshing', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ users: USERS }))
    fetchMock.mockResolvedValueOnce(errorEnvelope('unknown_user', 'No such user', 404))
    render(<UserPicker />)

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'User' }), 'p1')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No such user')
    expect(refresh).not.toHaveBeenCalled()
  })
})
