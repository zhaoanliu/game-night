import { NextResponse } from 'next/server'
import { ApiError, handleRoute } from '@/lib/api'
import { SESSION_COOKIE, findUser, getCurrentUser } from '@/lib/auth'

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
}

export async function GET() {
  return handleRoute(async () => {
    const user = await getCurrentUser()
    return NextResponse.json({ user })
  })
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const body = await request.json().catch(() => null)
    const userId = (body as { userId?: unknown } | null)?.userId

    if (typeof userId !== 'string' || userId.length === 0) {
      throw new ApiError(400, 'validation_error', 'userId is required')
    }

    const user = await findUser(userId)
    if (!user) {
      throw new ApiError(404, 'unknown_user', 'No such user')
    }

    const response = NextResponse.json({ user })
    response.cookies.set(SESSION_COOKIE, user.id, COOKIE_OPTIONS)
    return response
  })
}

export async function DELETE() {
  return handleRoute(async () => {
    const response = NextResponse.json({ user: null })
    response.cookies.set(SESSION_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 })
    return response
  })
}
