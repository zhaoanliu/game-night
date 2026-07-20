import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrganizerDashboard } from '@/components/organizer/OrganizerDashboard'
import { jsonResponse, stubFetch } from '../../helpers/http'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OrganizerDashboard', () => {
  it('refetches the list after a successful create', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/organizer/events') return Promise.resolve(jsonResponse({ events: [] }))
      if (path === '/api/events' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ event: { id: 'new1', title: 'Sealed League Night' } }, 201))
      }
      return Promise.resolve(jsonResponse({}))
    })
    render(<OrganizerDashboard />)
    await screen.findByText("You haven't created any events yet")

    await userEvent.type(screen.getByLabelText('Title'), 'Sealed League Night')
    await userEvent.type(screen.getByLabelText('Capacity'), '8')
    await userEvent.type(screen.getByLabelText('Starts'), '2027-06-01T19:00')
    await userEvent.type(screen.getByLabelText('Location'), 'Card Kingdom')
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    await waitFor(() => {
      const listFetches = fetchMock.mock.calls.filter(([path]) => path === '/api/organizer/events')
      expect(listFetches.length).toBe(2)
    })
  })
})
