// Creates .env.local from .env.example on first run so `npm run setup` is a
// single command. Never overwrites an existing .env.local.
import { copyFileSync, existsSync } from 'node:fs'

if (existsSync('.env.local')) {
  console.log('.env.local already exists — leaving it alone')
} else {
  copyFileSync('.env.example', '.env.local')
  console.log('Created .env.local from .env.example')
}
