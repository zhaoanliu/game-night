import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventList } from '@/components/events/EventList'
import { errorEnvelope, jsonResponse, stubFetch } from '../../helpers/http'
import type { EventWithCount } from '@/lib/types'

function makeEvent(overrides: Partial<EventWithCount>): EventWithCount {
  return {
    id: 'e1',
    organizer_id: 'o1',
    title: 'Friday Night Magic',
    game_type: 'tcg',
    starts_at: '2027-01-08T03:00:00Z',
    ends_at: '2027-01-08T07:00:00Z',
    location: 'Mox Boarding House',
    capacity: 12,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    attendee_count: 11,
    seats_left: 1,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EventList', () => {
  it('shows skeletons while loading, then cards with seat badges', async () => {
    stubFetch().mockResolvedValue(
      jsonResponse({
        events: [
          makeEvent({}),
          makeEvent({ id: 'e2', title: 'Commander Pod', seats_left: 0, attendee_count: 4, capacity: 4 }),
        ],
      })
    )
    render(<EventList />)

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)

    expect(await screen.findByText('Friday Night Magic')).toBeInTheDocument()
    expect(screen.getByText('1 seat left')).toBeInTheDocument()
    expect(screen.getByText('Full')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Friday Night Magic/ })).toHaveAttribute('href', '/events/e1')
  })

  it('sends the search query as q after debounce', async () => {
    const fetchMock = stubFetch().mockResolvedValue(jsonResponse({ events: [] }))
    render(<EventList />)
    await screen.findByText('No upcoming events')

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search events' }), 'magic')

    await waitFor(() => {
      const paths = fetchMock.mock.calls.map(([path]) => path)
      expect(paths).toContain('/api/events?q=magic')
    })
  })

  it('filters by game type chip and marks it pressed', async () => {
    const fetchMock = stubFetch().mockResolvedValue(jsonResponse({ events: [] }))
    render(<EventList />)
    await screen.findByText('No upcoming events')

    const chip = screen.getByRole('button', { name: 'TCG' })
    await userEvent.click(chip)

    await waitFor(() => {
      const paths = fetchMock.mock.calls.map(([path]) => path)
      expect(paths).toContain('/api/events?game_type=tcg')
    })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('No events match your search')).toBeInTheDocument()
  })

  it('shows the error state and recovers on retry', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(errorEnvelope('internal_error', 'Something went wrong', 500))
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [makeEvent({})] }))
    render(<EventList />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Friday Night Magic')).toBeInTheDocument()
  })
})
