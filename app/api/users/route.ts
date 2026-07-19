import { NextResponse } from 'next/server'
import { ApiError, handleRoute } from '@/lib/api'
import { createServiceClient } from '@/lib/supabase/service'

// Powers the "who are you?" picker. With no real authentication there is
// nothing secret about the roster, and the picker needs it before anyone is
// identified — so this is the one route that does not require a session.
export async function GET() {
  return handleRoute(async () => {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, name, role')
      .order('name', { ascending: true })

    if (error) {
      console.error('list users failed:', error.message, error)
      throw new ApiError(500, 'internal_error', 'Could not load users')
    }

    return NextResponse.json({ users: data })
  })
}
