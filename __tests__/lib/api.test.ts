import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextResponse } from 'next/server'
import { ApiError, errorResponse, handleRoute } from '@/lib/api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('errorResponse', () => {
  it('renders the error envelope with the error status', async () => {
    const response = errorResponse(new ApiError(404, 'event_not_found', 'No such event'))
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'event_not_found', message: 'No such event' },
    })
  })

  it('includes per-field messages when present', async () => {
    const response = errorResponse(
      new ApiError(400, 'validation_error', 'Invalid event input', { capacity: 'too small' })
    )
    await expect(response.json()).resolves.toEqual({
      error: { code: 'validation_error', message: 'Invalid event input', fields: { capacity: 'too small' } },
    })
  })
})

describe('handleRoute', () => {
  it('passes a successful response straight through', async () => {
    const response = await handleRoute(async () => NextResponse.json({ ok: true }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('converts a thrown ApiError into its own status and envelope', async () => {
    const response = await handleRoute(async () => {
      throw new ApiError(403, 'forbidden', 'Organizers only')
    })
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'forbidden', message: 'Organizers only' },
    })
  })

  it('converts an unexpected error into a logged 500 without leaking details', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await handleRoute(async () => {
      throw new Error('connection reset by peer')
    })

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'internal_error', message: 'Something went wrong' },
    })
    expect(consoleError).toHaveBeenCalled()
    expect(JSON.stringify(consoleError.mock.calls)).toContain('connection reset by peer')
  })
})
