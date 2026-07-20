import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@/lib/client/api'
import { errorEnvelope, jsonResponse, stubFetch } from '../../helpers/http'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('returns ok with parsed data on success', async () => {
    stubFetch().mockResolvedValue(jsonResponse({ users: [{ id: 'u1' }] }))

    const result = await apiFetch<{ users: { id: string }[] }>('/api/users')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.status).toBe(200)
      expect(result.data.users).toEqual([{ id: 'u1' }])
    }
  })

  it('parses the error envelope into code, message, and fields', async () => {
    stubFetch().mockResolvedValue(
      errorEnvelope('validation_error', 'Invalid event input', 400, { title: 'Title is required' })
    )

    const result = await apiFetch('/api/events', { method: 'POST', body: '{}' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(400)
      expect(result.code).toBe('validation_error')
      expect(result.message).toBe('Invalid event input')
      expect(result.fields).toEqual({ title: 'Title is required' })
    }
  })

  it('handles error responses with no JSON body', async () => {
    stubFetch().mockResolvedValue(new Response('gateway timeout', { status: 504 }))

    const result = await apiFetch('/api/events')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unknown_error')
      expect(result.status).toBe(504)
    }
  })

  it('maps a thrown fetch into network_error', async () => {
    stubFetch().mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await apiFetch('/api/events')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('network_error')
      expect(result.status).toBe(0)
    }
  })

  it('sets Content-Type only when a body is sent', async () => {
    const fetchMock = stubFetch().mockResolvedValue(jsonResponse({}))

    await apiFetch('/api/session', { method: 'POST', body: JSON.stringify({ userId: 'u1' }) })
    await apiFetch('/api/session')

    const [, withBodyInit] = fetchMock.mock.calls[0]
    const [, withoutBodyInit] = fetchMock.mock.calls[1]
    expect((withBodyInit as RequestInit).headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect((withoutBodyInit as RequestInit).headers).not.toMatchObject({
      'Content-Type': 'application/json',
    })
  })
})
