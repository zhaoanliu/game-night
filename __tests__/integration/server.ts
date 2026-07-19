import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { loadEnv } from './env'

// Boots the real Next.js server once for the whole integration run.
//
// Deliberately a production build, not `next dev`: the point of these tests is
// that the shipped server enforces the rules, and dev-mode differences in
// bundling and route handling have no business in that proof.

export const PORT = Number(process.env.INTEGRATION_PORT ?? 3100)
export const BASE_URL = `http://127.0.0.1:${PORT}`

let server: ChildProcess | undefined

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    )
  })
}

async function waitForServer(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/api/users`)
      if (response.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Server did not become ready at ${BASE_URL} within ${timeoutMs}ms`)
}

export async function setup(): Promise<void> {
  loadEnv()

  if (!existsSync('.next/BUILD_ID')) {
    console.log('No production build found — building first')
    await run('npm', ['run', 'build'])
  }

  server = spawn('npm', ['start', '--', '--port', String(PORT)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
  })

  await waitForServer()
}

export async function teardown(): Promise<void> {
  if (!server) return
  server.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      server?.kill('SIGKILL')
      resolve(null)
    }, 5_000)
    server?.on('exit', () => {
      clearTimeout(timer)
      resolve(null)
    })
  })
}
