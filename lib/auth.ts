import { cookies } from 'next/headers'
import { ApiError } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/service'
import type { Role, User } from '@/lib/types'

export const SESSION_COOKIE = 'gn_user_id'

// Identity is self-asserted: the cookie holds a seeded user id, chosen from a
// picker. That is enough for this exercise and is stated plainly in the README.
// What matters is that the *server* decides what each role may do — every
// handler resolves the user here rather than trusting anything in the request
// body. Swapping this for real authentication changes only this file.
export async function findUser(id: string): Promise<User | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    // A malformed uuid is a bad id, not a server fault.
    if (error.code === '22P02') return null
    console.error('findUser failed:', error.message, error)
    throw new ApiError(500, 'internal_error', 'Could not load user')
  }

  return data as User | null
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies()
  const id = store.get(SESSION_COOKIE)?.value
  if (!id) return null
  return findUser(id)
}

export async function requireUser(role?: Role): Promise<User> {
  const user = await getCurrentUser()

  if (!user) {
    throw new ApiError(401, 'not_identified', 'Choose who you are to continue')
  }

  if (role && user.role !== role) {
    throw new ApiError(
      403,
      'forbidden',
      role === 'organizer'
        ? 'Only organizers can do that'
        : 'Only players can do that'
    )
  }

  return user
}
