import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventDetail } from '@/components/events/EventDetail'
import { errorEnvelope, jsonResponse, stubFetch } from '../../helpers/http'
import type { EventWithCount } from '@/lib/types'

const EVENT: EventWithCount = {
  id: 'e1',
  organizer_id: 'o1',
  title: 'Commander Pod',
  game_type: 'tcg',
  starts_at: '2027-01-08T03:00:00Z',
  ends_at: '2027-01-08T07:00:00Z',
  location: 'Card Kingdom, Ballard',
  capacity: 4,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  attendee_count: 3,
  seats_left: 1,
}

function detailResponse(overrides: { my_rsvp?: boolean; is_owner?: boolean } = {}) {
  return jsonResponse({ event: EVENT, my_rsvp: false, is_owner: false, ...overrides })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EventDetail', () => {
  it('renders the event with seats and an RSVP button for players', async () => {
    stubFetch().mockResolvedValue(detailResponse())
    render(<EventDetail eventId="e1" role="player" />)

    expect(await screen.findByRole('heading', { name: 'Commander Pod' })).toBeInTheDocument()
    expect(screen.getByText('Card Kingdom, Ballard')).toBeInTheDocument()
    expect(screen.getByText('3 of 4 seats taken')).toBeInTheDocument()
    expect(screen.getByText('1 seat left')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'RSVP' })).toBeInTheDocument()
  })

  it('settles the visible count from the RSVP mutation response', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(detailResponse())
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'confirmed', attendee_count: 4, seats_left: 0 }, 201))
    render(<EventDetail eventId="e1" role="player" />)

    await userEvent.click(await screen.findByRole('button', { name: 'RSVP' }))

    expect(await screen.findByText('4 of 4 seats taken')).toBeInTheDocument()
    expect(screen.getByText('Full')).toBeInTheDocument()
    expect(screen.getByText("You're in ✓")).toBeInTheDocument()
  })

  it('shows no RSVP controls to organizers', async () => {
    stubFetch().mockResolvedValue(detailResponse())
    render(<EventDetail eventId="e1" role="organizer" />)

    await screen.findByRole('heading', { name: 'Commander Pod' })
    expect(screen.queryByRole('button', { name: 'RSVP' })).not.toBeInTheDocument()
  })

  it('shows the roster to the owning organizer only', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockImplementation((path: string) => {
      if (path === '/api/events/e1') return Promise.resolve(detailResponse({ is_owner: true }))
      return Promise.resolve(
        jsonResponse({ event: EVENT, attendees: [{ id: 'p1', name: 'Amara Okonkwo', created_at: '' }] })
      )
    })
    render(<EventDetail eventId="e1" role="organizer" />)

    expect(await screen.findByText('Amara Okonkwo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Attendees (1)' })).toBeInTheDocument()
  })

  it('shows an error state with retry when the event fails to load', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(errorEnvelope('event_not_found', 'No such event', 404))
    fetchMock.mockResolvedValueOnce(detailResponse())
    render(<EventDetail eventId="e1" role="player" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('No such event')

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Commander Pod' })).toBeInTheDocument()
  })
})
