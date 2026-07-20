import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RsvpButton } from '@/components/events/RsvpButton'
import { errorEnvelope, jsonResponse, stubFetch } from '../../helpers/http'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RsvpButton', () => {
  it('disables while pending and settles counts from the mutation response', async () => {
    const onUpdate = vi.fn()
    const fetchMock = stubFetch()
    let release: (value: Response) => void = () => {}
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (release = resolve)))

    render(<RsvpButton eventId="e1" myRsvp={false} onUpdate={onUpdate} />)
    const button = screen.getByRole('button', { name: 'RSVP' })
    await userEvent.click(button)

    expect(button).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Reserving…')

    release(jsonResponse({ status: 'confirmed', attendee_count: 5, seats_left: 0 }, 201))

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ attendee_count: 5, seats_left: 0 }, true)
    )
    expect(screen.getByRole('status')).toHaveTextContent("You're in!")
  })

  it('treats already_rsvpd as success', async () => {
    const onUpdate = vi.fn()
    stubFetch().mockResolvedValue(jsonResponse({ status: 'already_rsvpd', attendee_count: 5, seats_left: 0 }))

    render(<RsvpButton eventId="e1" myRsvp={false} onUpdate={onUpdate} />)
    await userEvent.click(screen.getByRole('button', { name: 'RSVP' }))

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ attendee_count: 5, seats_left: 0 }, true)
    )
  })

  it('shows Event is full inline on 409 and refreshes counts', async () => {
    const onUpdate = vi.fn()
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(errorEnvelope('event_full', 'This event is full', 409))
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        event: { attendee_count: 4, seats_left: 0 },
        my_rsvp: false,
        is_owner: false,
      })
    )

    render(<RsvpButton eventId="e1" myRsvp={false} onUpdate={onUpdate} />)
    await userEvent.click(screen.getByRole('button', { name: 'RSVP' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Event is full'))
    expect(fetchMock.mock.calls[1][0]).toBe('/api/events/e1')
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ attendee_count: 4, seats_left: 0 }, false)
    )
  })

  it('explains a 422 on an already-started event', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(errorEnvelope('event_started', 'This event has already started', 422))
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ event: { attendee_count: 5, seats_left: 3 }, my_rsvp: false, is_owner: false })
    )

    render(<RsvpButton eventId="e1" myRsvp={false} onUpdate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'RSVP' }))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('This event has already started')
    )
  })

  it('surfaces other failures via their message', async () => {
    stubFetch().mockResolvedValue(errorEnvelope('not_identified', 'Pick a user first', 401))

    render(<RsvpButton eventId="e1" myRsvp={false} onUpdate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'RSVP' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Pick a user first'))
  })

  it('cancels a held seat and settles counts from the response', async () => {
    const onUpdate = vi.fn()
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValue(jsonResponse({ status: 'cancelled', attendee_count: 4, seats_left: 1 }))

    render(<RsvpButton eventId="e1" myRsvp={true} onUpdate={onUpdate} />)
    expect(screen.getByText("You're in ✓")).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel RSVP' }))

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({ attendee_count: 4, seats_left: 1 }, false)
    )
    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/api/events/e1/rsvp')
    expect((init as RequestInit).method).toBe('DELETE')
    expect(screen.getByRole('status')).toHaveTextContent('Your seat has been released')
  })

  it('surfaces a failed cancel via its message', async () => {
    stubFetch().mockResolvedValue(errorEnvelope('event_not_found', 'No such event', 404))

    render(<RsvpButton eventId="e1" myRsvp={true} onUpdate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel RSVP' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No such event'))
  })
})
