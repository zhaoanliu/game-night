import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttendeeList } from '@/components/events/AttendeeList'
import { errorEnvelope, jsonResponse, stubFetch } from '../../helpers/http'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AttendeeList', () => {
  it('lists attendees with a count', async () => {
    stubFetch().mockResolvedValue(
      jsonResponse({
        attendees: [
          { id: 'p1', name: 'Amara Okonkwo', created_at: '' },
          { id: 'p2', name: 'Devon Clarke', created_at: '' },
        ],
      })
    )
    render(<AttendeeList eventId="e1" />)

    expect(await screen.findByRole('heading', { name: 'Attendees (2)' })).toBeInTheDocument()
    expect(screen.getByText('Amara Okonkwo')).toBeInTheDocument()
    expect(screen.getByText('Devon Clarke')).toBeInTheDocument()
  })

  it('shows an empty state when nobody has RSVPd', async () => {
    stubFetch().mockResolvedValue(jsonResponse({ attendees: [] }))
    render(<AttendeeList eventId="e1" />)

    expect(await screen.findByText("No one has RSVP'd yet")).toBeInTheDocument()
  })

  it('renders the 403 envelope as an error state with retry', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(
      errorEnvelope('not_owner', 'You can only see attendees for your own events', 403)
    )
    fetchMock.mockResolvedValueOnce(jsonResponse({ attendees: [] }))
    render(<AttendeeList eventId="e1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You can only see attendees for your own events'
    )

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText("No one has RSVP'd yet")).toBeInTheDocument()
  })
})
