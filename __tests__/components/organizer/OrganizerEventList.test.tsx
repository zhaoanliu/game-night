import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OrganizerEventList } from '@/components/organizer/OrganizerEventList'
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

describe('OrganizerEventList', () => {
  it('lists events with counts and links to the detail page', async () => {
    stubFetch().mockResolvedValue(jsonResponse({ events: [makeEvent({})] }))
    render(<OrganizerEventList />)

    expect(await screen.findByRole('link', { name: 'Friday Night Magic' })).toHaveAttribute(
      'href',
      '/events/e1'
    )
    expect(screen.getByText('11 / 12')).toBeInTheDocument()
    expect(screen.getByText('1 seat left')).toBeInTheDocument()
    expect(screen.queryByText('In progress')).not.toBeInTheDocument()
  })

  it('marks an in-progress event', async () => {
    const now = Date.now()
    stubFetch().mockResolvedValue(
      jsonResponse({
        events: [
          makeEvent({
            starts_at: new Date(now - 3_600_000).toISOString(),
            ends_at: new Date(now + 3_600_000).toISOString(),
          }),
        ],
      })
    )
    render(<OrganizerEventList />)

    expect(await screen.findByText('In progress')).toBeInTheDocument()
  })

  it('shows the empty state', async () => {
    stubFetch().mockResolvedValue(jsonResponse({ events: [] }))
    render(<OrganizerEventList />)

    expect(await screen.findByText("You haven't created any events yet")).toBeInTheDocument()
  })

  it('renders the 403 for players as an error state', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(errorEnvelope('forbidden', 'Organizers only', 403))
    fetchMock.mockResolvedValueOnce(jsonResponse({ events: [] }))
    render(<OrganizerEventList />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Organizers only')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText("You haven't created any events yet")).toBeInTheDocument()
  })
})
