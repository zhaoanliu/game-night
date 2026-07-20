import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignOutButton } from '@/components/identity/SignOutButton'
import { jsonResponse, stubFetch } from '../../helpers/http'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  refresh.mockClear()
})

describe('SignOutButton', () => {
  it('clears the session and refreshes', async () => {
    const fetchMock = stubFetch().mockResolvedValue(jsonResponse({ user: null }))
    render(<SignOutButton />)

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/api/session')
    expect((init as RequestInit).method).toBe('DELETE')
  })
})
