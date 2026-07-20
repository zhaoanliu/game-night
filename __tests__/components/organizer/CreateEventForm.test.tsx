import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateEventForm } from '@/components/organizer/CreateEventForm'
import { errorEnvelope, jsonResponse, stubFetch } from '../../helpers/http'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText('Title'), 'Sealed League Night')
  await userEvent.selectOptions(screen.getByLabelText('Game type'), 'tcg')
  await userEvent.type(screen.getByLabelText('Capacity'), '8')
  // datetime-local needs the T-format; a year out keeps it firmly in the future
  await userEvent.type(screen.getByLabelText('Starts'), '2027-06-01T19:00')
  await userEvent.type(screen.getByLabelText('Location'), 'Card Kingdom, Ballard')
}

describe('CreateEventForm', () => {
  it('blocks submission client-side and renders per-field errors', async () => {
    const fetchMock = stubFetch()
    render(<CreateEventForm onCreated={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Capacity'), '0')
    await userEvent.type(screen.getByLabelText('Starts'), '2020-01-01T19:00')
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    expect(screen.getByTestId('error-title')).toHaveTextContent('Title is required (max 120 characters)')
    expect(screen.getByTestId('error-starts_at')).toHaveTextContent('Start time must be in the future')
    expect(screen.getByTestId('error-capacity')).toHaveTextContent(
      'Capacity must be an integer between 1 and 1000'
    )
    expect(screen.getByTestId('error-location')).toHaveTextContent(
      'Location is required (max 200 characters)'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('validates the optional end time against the start', async () => {
    const fetchMock = stubFetch()
    render(<CreateEventForm onCreated={vi.fn()} />)

    await fillValidForm()
    await userEvent.type(screen.getByLabelText(/^Ends/), '2027-06-01T18:00')
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    expect(screen.getByTestId('error-ends_at')).toHaveTextContent('End time must be after the start time')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits a valid form, resets it, and notifies the parent', async () => {
    const onCreated = vi.fn()
    const fetchMock = stubFetch().mockResolvedValue(
      jsonResponse({ event: { id: 'new1', title: 'Sealed League Night' } }, 201)
    )
    render(<CreateEventForm onCreated={onCreated} />)

    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
    expect(screen.getByRole('status')).toHaveTextContent('Created "Sealed League Night"')
    expect(screen.getByLabelText('Title')).toHaveValue('')

    const [path, init] = fetchMock.mock.calls[0]
    expect(path).toBe('/api/events')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.title).toBe('Sealed League Night')
    expect(body.game_type).toBe('tcg')
    expect(body.capacity).toBe(8)
    expect(body.starts_at).toMatch(/Z$/)
    expect(body).not.toHaveProperty('ends_at')
  })

  it('renders per-field server errors from a 400 envelope', async () => {
    // The client mirror blocks obviously-bad input, so a server fields map is
    // only reachable when the two disagree — exactly what this pins down.
    stubFetch().mockResolvedValue(
      errorEnvelope('validation_error', 'Invalid event input', 400, {
        starts_at: 'Start time must be in the future',
      })
    )
    render(<CreateEventForm onCreated={vi.fn()} />)

    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    expect(await screen.findByTestId('error-starts_at')).toHaveTextContent(
      'Start time must be in the future'
    )
  })

  it('shows a form-level error for non-validation failures', async () => {
    stubFetch().mockResolvedValue(errorEnvelope('internal_error', 'Could not create the event', 500))
    render(<CreateEventForm onCreated={vi.fn()} />)

    await fillValidForm()
    await userEvent.click(screen.getByRole('button', { name: 'Create event' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the event')
  })
})
