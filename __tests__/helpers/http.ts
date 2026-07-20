import { vi } from 'vitest'

// Not a real Response: fetch bodies are single-use, which breaks
// mockResolvedValue sharing one instance across calls. This json() can be
// consumed any number of times.
export function jsonResponse(body: unknown, status = 200): Response {
  const payload = JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(payload),
  } as unknown as Response
}

export function errorEnvelope(
  code: string,
  message: string,
  status: number,
  fields?: Record<string, string>
): Response {
  return jsonResponse({ error: { code, message, ...(fields && { fields }) } }, status)
}

// Installs a fetch mock for the current test; vitest's unstubGlobals config is
// off, so tests restore via vi.unstubAllGlobals() in afterEach.
export function stubFetch(): ReturnType<typeof vi.fn> {
  const mock = vi.fn()
  vi.stubGlobal('fetch', mock)
  return mock
}
