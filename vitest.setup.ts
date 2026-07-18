import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom v29 no longer provides a functional localStorage — stub it globally
// so tests can call clear/getItem/setItem without TypeError.
const _localStore: Record<string, string> = {}
const localStorageMock: Storage = {
  getItem: (k: string) => _localStore[k] ?? null,
  setItem: (k: string, v: string) => { _localStore[k] = v },
  removeItem: (k: string) => { delete _localStore[k] },
  clear: () => { Object.keys(_localStore).forEach(k => delete _localStore[k]) },
  get length() { return Object.keys(_localStore).length },
  key: (n: number) => Object.keys(_localStore)[n] ?? null,
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

// Next.js navigation — components under test don't need real routing
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  redirect: vi.fn(),
}))

// next/font cannot run in jsdom
vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'mock-inter' }),
}))
