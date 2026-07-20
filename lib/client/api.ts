// Client-side counterpart of lib/api.ts: every component fetch goes through
// here so the error envelope is parsed exactly once, into a result the caller
// can switch on instead of try/catch-ing.
export interface ApiSuccess<T> {
  ok: true
  status: number
  data: T
}

export interface ApiFailure {
  ok: false
  status: number
  code: string
  message: string
  fields?: Record<string, string>
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

interface ErrorEnvelope {
  error?: {
    code?: string
    message?: string
    fields?: Record<string, string>
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    return {
      ok: false,
      status: 0,
      code: 'network_error',
      message: 'Could not reach the server. Check your connection and try again.',
    }
  }

  const body = (await response.json().catch(() => null)) as unknown

  if (!response.ok) {
    const error = (body as ErrorEnvelope | null)?.error
    return {
      ok: false,
      status: response.status,
      code: error?.code ?? 'unknown_error',
      message: error?.message ?? 'Something went wrong',
      ...(error?.fields && { fields: error.fields }),
    }
  }

  return { ok: true, status: response.status, data: body as T }
}
