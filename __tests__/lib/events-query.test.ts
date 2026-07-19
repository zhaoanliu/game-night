import { describe, it, expect } from 'vitest'
import { parseGameType } from '@/lib/validation'
import { ApiError } from '@/lib/api'

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
