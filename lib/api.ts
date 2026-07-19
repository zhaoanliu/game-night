import { NextResponse } from 'next/server'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message)
  }
}

export function errorResponse(error: ApiError): NextResponse {
  return NextResponse.json(
    { error: { code: error.code, message: error.message, ...(error.fields && { fields: error.fields }) } },
    { status: error.status }
  )
}

// Wraps a route handler body: ApiError → its status/envelope, anything else → 500.
export async function handleRoute(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error)
    }
    console.error('unhandled route error:', error instanceof Error ? error.message : error, error)
    return errorResponse(new ApiError(500, 'internal_error', 'Something went wrong'))
  }
}
