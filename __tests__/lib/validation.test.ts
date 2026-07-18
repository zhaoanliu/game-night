import { describe, it, expect } from 'vitest'
import { validateEventInput, CAPACITY_MAX, TITLE_MAX, LOCATION_MAX } from '@/lib/validation'
import { ApiError } from '@/lib/api'

const future = () => new Date(Date.now() + 86_400_000).toISOString()

const valid = () => ({
  title: 'Friday Night Magic',
  game_type: 'tcg',
  starts_at: future(),
  location: 'Mox Boarding House',
  capacity: 8,
})

function fieldsFor(input: unknown): Record<string, string> {
  try {
    validateEventInput(input)
  } catch (error) {
    if (error instanceof ApiError) return error.fields ?? {}
    throw error
  }
  throw new Error('expected validation to fail')
}

describe('validateEventInput', () => {
  it('accepts a well-formed event and normalises the timestamp', () => {
    const result = validateEventInput(valid())
    expect(result.title).toBe('Friday Night Magic')
    expect(result.game_type).toBe('tcg')
    expect(result.capacity).toBe(8)
    expect(result.starts_at).toMatch(/Z$/)
  })

  it('trims surrounding whitespace from text fields', () => {
    const result = validateEventInput({ ...valid(), title: '  Draft Night  ', location: '  Card Kingdom ' })
    expect(result.title).toBe('Draft Night')
    expect(result.location).toBe('Card Kingdom')
  })

  it('rejects a non-object body', () => {
    expect(() => validateEventInput(null)).toThrow(ApiError)
    expect(() => validateEventInput('nope')).toThrow(ApiError)
  })

  it('rejects a past start time', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(fieldsFor({ ...valid(), starts_at: past })).toHaveProperty('starts_at')
  })

  it('rejects an unparseable start time', () => {
    expect(fieldsFor({ ...valid(), starts_at: 'next tuesday' })).toHaveProperty('starts_at')
  })

  it('rejects an unknown game type', () => {
    expect(fieldsFor({ ...valid(), game_type: 'chess' })).toHaveProperty('game_type')
  })

  it('rejects capacity below one, above the maximum, or non-integer', () => {
    expect(fieldsFor({ ...valid(), capacity: 0 })).toHaveProperty('capacity')
    expect(fieldsFor({ ...valid(), capacity: CAPACITY_MAX + 1 })).toHaveProperty('capacity')
    expect(fieldsFor({ ...valid(), capacity: 4.5 })).toHaveProperty('capacity')
    expect(fieldsFor({ ...valid(), capacity: '8' })).toHaveProperty('capacity')
  })

  it('rejects empty and over-long title and location', () => {
    expect(fieldsFor({ ...valid(), title: '   ' })).toHaveProperty('title')
    expect(fieldsFor({ ...valid(), title: 'x'.repeat(TITLE_MAX + 1) })).toHaveProperty('title')
    expect(fieldsFor({ ...valid(), location: '' })).toHaveProperty('location')
    expect(fieldsFor({ ...valid(), location: 'x'.repeat(LOCATION_MAX + 1) })).toHaveProperty('location')
  })

  it('reports every invalid field at once rather than stopping at the first', () => {
    const fields = fieldsFor({ title: '', game_type: 'chess', starts_at: 'nope', location: '', capacity: 0 })
    expect(Object.keys(fields).sort()).toEqual(['capacity', 'game_type', 'location', 'starts_at', 'title'])
  })
})
