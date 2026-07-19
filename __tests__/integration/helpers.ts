import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnv } from './env'
import { BASE_URL } from './server'

loadEnv()

// Integration tests own their fixtures: they create their own users and events
// and delete them afterwards. They never rely on seed.sql rows, so a reseed or
// a demo left mid-flight cannot make them pass or fail spuriously.
//
// Note what cleanup does NOT do: delete rsvps. The application role has no
// delete privilege on that table by design, so tests remove RSVPs the same way
// production would — by deleting the event and letting the cascade run.

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const TEST_PREFIX = 'itest:'

export interface TestUser {
  id: string
  name: string
  role: 'player' | 'organizer'
}

export async function createUsers(role: 'player' | 'organizer', count: number): Promise<TestUser[]> {
  const rows = Array.from({ length: count }, (_, i) => ({
    name: `${TEST_PREFIX}${role}-${crypto.randomUUID().slice(0, 8)}-${i}`,
    role,
  }))

  const { data, error } = await serviceClient().from('users').insert(rows).select('id, name, role')
  if (error) throw new Error(`createUsers failed: ${error.message}`)
  return data as TestUser[]
}

export async function createUser(role: 'player' | 'organizer'): Promise<TestUser> {
  const [user] = await createUsers(role, 1)
  return user
}

export interface TestEventInput {
  organizerId: string
  capacity: number
  startsAt?: Date
  title?: string
}

export async function createEvent({
  organizerId,
  capacity,
  startsAt,
  title,
}: TestEventInput): Promise<{ id: string; capacity: number }> {
  const { data, error } = await serviceClient()
    .from('events')
    .insert({
      organizer_id: organizerId,
      title: title ?? `${TEST_PREFIX}event-${crypto.randomUUID().slice(0, 8)}`,
      game_type: 'other',
      starts_at: (startsAt ?? new Date(Date.now() + 86_400_000)).toISOString(),
      location: 'Integration test hall',
      capacity,
    })
    .select('id, capacity')
    .single()

  if (error) throw new Error(`createEvent failed: ${error.message}`)
  return data as { id: string; capacity: number }
}

export async function countRsvps(eventId: string): Promise<number> {
  const { count, error } = await serviceClient()
    .from('rsvps')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (error) throw new Error(`countRsvps failed: ${error.message}`)
  return count ?? 0
}

export async function cleanup(): Promise<void> {
  const supabase = serviceClient()
  // Deleting events cascades to their rsvps.
  await supabase.from('events').delete().like('title', `${TEST_PREFIX}%`)
  await supabase.from('users').delete().like('name', `${TEST_PREFIX}%`)
}

export interface ApiResponse<T = unknown> {
  status: number
  body: T
}

// A request as a specific user. The session cookie is just the user id, so it
// can be set directly rather than round-tripping through POST /api/session.
export async function asUser<T = unknown>(
  user: { id: string } | null,
  path: string,
  init: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers)
  if (user) headers.set('cookie', `gn_user_id=${user.id}`)
  if (init.body) headers.set('content-type', 'application/json')

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  const body = (await response.json().catch(() => null)) as T
  return { status: response.status, body }
}
