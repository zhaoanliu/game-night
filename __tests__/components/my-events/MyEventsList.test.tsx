import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyEventsList } from '@/components/my-events/MyEventsList'
import { errorEnvelope, jsonResponse, stubFetch } from '../../helpers/http'
import type { EventWithCount } from '@/lib/types'

function makeEvent(id: string, title: string): EventWithCount {
  return {
    id,
    organizer_id: 'o1',
    title,
    game_type: 'boardgame',
    starts_at: '2027-01-08T03:00:00Z',
    ends_at: '2027-01-08T07:00:00Z',
    location: 'Guild Hall Games',
    capacity: 8,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    attendee_count: 3,
    seats_left: 5,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MyEventsList', () => {
  it('lists upcoming RSVPs in API order with links to detail', async () => {
    stubFetch().mockResolvedValue(
      jsonResponse({ events: [makeEvent('e1', 'Heavy Euro Meetup'), makeEvent('e2', 'Draft Night')] })
    )
    render(<MyEventsList />)

    const links = await screen.findAllByRole('link', { name: /Meetup|Draft/ })
    expect(links.map((link) => link.textContent)).toEqual(['Heavy Euro Meetup', 'Draft Night'])
    expect(links[0]).toHaveAttribute('href', '/events/e1')
  })

  it('shows the empty state with a link to browse', async () => {
    stubFetch().mockResolvedValue(jsonResponse({ events: [] }))
    render(<MyEventsList />)

    expect(await screen.findByText("You haven't RSVP'd to any upcoming events")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse events' })).toHaveAttribute('href', '/')
  })

  it('removes an event from the list after inline cancel', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ events: [makeEvent('e1', 'Heavy Euro Meetup'), makeEvent('e2', 'Draft Night')] })
    )
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'cancelled', attendee_count: 2, seats_left: 6 }))
    render(<MyEventsList />)

    await screen.findByText('Heavy Euro Meetup')
    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0])

    await waitFor(() => expect(screen.queryByText('Heavy Euro Meetup')).not.toBeInTheDocument())
    expect(screen.getByText('Draft Night')).toBeInTheDocument()
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toBe('/api/events/e1/rsvp')
    expect((init as RequestInit).method).toBe('DELETE')
  })

  it('keeps the event and shows the message when cancel fails', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [makeEvent('e1', 'Heavy Euro Meetup')] }))
    fetchMock.mockResolvedValueOnce(errorEnvelope('internal_error', 'Something went wrong', 500))
    render(<MyEventsList />)

    await screen.findByText('Heavy Euro Meetup')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByText('Heavy Euro Meetup')).toBeInTheDocument()
  })

  it('shows the error state with retry when loading fails', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(errorEnvelope('forbidden', 'Players only', 403))
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [] }))
    render(<MyEventsList />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Players only')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText("You haven't RSVP'd to any upcoming events")).toBeInTheDocument()
  })
})
