import { describe, it, expect } from 'vitest'
import { parseEventWindow, parseGameType } from '@/lib/validation'
import { ApiError } from '@/lib/api'

describe('parseEventWindow', () => {
  it('defaults to upcoming when unspecified', () => {
    expect(parseEventWindow(null)).toBe('upcoming')
    expect(parseEventWindow('')).toBe('upcoming')
  })

  it('accepts both windows', () => {
    expect(parseEventWindow('upcoming')).toBe('upcoming')
    expect(parseEventWindow('past')).toBe('past')
  })

  it('rejects anything else rather than silently defaulting', () => {
    expect(() => parseEventWindow('yesterday')).toThrow(ApiError)
    try {
      parseEventWindow('yesterday')
    } catch (error) {
      expect((error as ApiError).status).toBe(400)
      expect((error as ApiError).code).toBe('invalid_window')
    }
  })
})

describe('parseGameType', () => {
  it('accepts a known game type', () => {
    expect(parseGameType('tcg')).toBe('tcg')
    expect(parseGameType('boardgame')).toBe('boardgame')
  })

  it('treats a missing filter as no filter', () => {
    expect(parseGameType(null)).toBeUndefined()
    expect(parseGameType('')).toBeUndefined()
  })

  it('rejects an unknown game type rather than silently ignoring it', () => {
    expect(() => parseGameType('chess')).toThrow(ApiError)
    try {
      parseGameType('chess')
    } catch (error) {
      expect((error as ApiError).status).toBe(400)
      expect((error as ApiError).code).toBe('invalid_game_type')
    }
  })
})
