import { existsSync, readFileSync } from 'node:fs'

// Loads .env.local for the integration run.
//
// Next.js deliberately ignores .env.local when NODE_ENV is "test", which is
// exactly what Vitest sets — so neither the test process nor a server spawned
// from it would otherwise see the database credentials. Both read them here
// instead, and the server is started with NODE_ENV=production (it is a
// production build).
let loaded = false

export function loadEnv(): void {
  if (loaded) return
  loaded = true

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
