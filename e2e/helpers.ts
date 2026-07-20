import { existsSync, readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Fixed ids from supabase/seed.sql — the seed-contract integration test keeps
// these promises honest.
export const USERS = {
  alice: '22222222-2222-2222-2222-222222222201', // organizer of Midweek (in progress)
  ben: '22222222-2222-2222-2222-222222222202', // another organizer
  yuki: '33333333-3333-3333-3333-333333330012', // player holding no RSVPs
}

export const EVENTS = {
  fridayNightMagic: '11111111-1111-1111-1111-111111110001', // 1 seat left of 12, starts in 2 days
  commanderPod: '11111111-1111-1111-1111-111111110002', // FULL at 4
  heavyEuro: '11111111-1111-1111-1111-111111110003', // 3 of 8, starts in 5 days
  gloomhaven: '11111111-1111-1111-1111-111111110004', // 1 seat left of 6
  midweek: '11111111-1111-1111-1111-111111110010', // happening right now
}

// First five players alphabetically — the stable roster of the in-progress
// seeded event.
export const MIDWEEK_ROSTER = [
  'Amara Okonkwo',
  'Devon Clarke',
  'Elena Rossi',
  'Jasmine Park',
  'Marcus Webb',
]

// page.request shares the browser context's cookie jar, so the httpOnly
// session cookie set here is exactly what the page then navigates with.
export async function signInAs(page: Page, userId: string): Promise<void> {
  const response = await page.request.post('/api/session', { data: { userId } })
  if (!response.ok()) throw new Error(`signInAs(${userId}) failed: ${response.status()}`)
}

// State restoration goes through the public API on purpose: the service role
// cannot write rsvps (single-writable-path invariant), and the tests should
// live under the same rules as the code they test.
export async function apiRsvp(page: Page, eventId: string): Promise<void> {
  const response = await page.request.post(`/api/events/${eventId}/rsvp`)
  if (!response.ok()) throw new Error(`apiRsvp(${eventId}) failed: ${response.status()}`)
}

export async function apiCancel(page: Page, eventId: string): Promise<void> {
  const response = await page.request.delete(`/api/events/${eventId}/rsvp`)
  if (!response.ok()) throw new Error(`apiCancel(${eventId}) failed: ${response.status()}`)
}

function loadEnv(): void {
  const file = ['.env.local', '.env.example'].find(existsSync)
  if (!file) return
  for (const line of readFileSync(file, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, '')
  }
}

// The one cleanup the public API cannot do: there is deliberately no DELETE
// /api/events endpoint, so the event created by the organizer spec is removed
// with the service client. Deleting the event cascades to its rsvps — the
// rsvps table itself stays unwritable.
export async function deleteEventByTitle(title: string): Promise<void> {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env for e2e cleanup')

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await supabase.from('events').delete().eq('title', title)
  if (error) throw new Error(`deleteEventByTitle(${title}) failed: ${error.message}`)
}
