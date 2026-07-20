import { execSync } from 'node:child_process'

// One reset per run: every spec starts from the seed contract (one full event,
// two at one seat left, one in progress, one past, Yuki with no RSVPs) and
// restores whatever it mutates through the public API.
export default function globalSetup() {
  execSync('npx supabase db reset', { stdio: 'inherit' })
}
