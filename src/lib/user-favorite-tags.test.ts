import { describe, expect, it } from 'vitest'
import { parseStoredFavoriteTagIds, stringifyFavoriteTagIds } from './user-favorite-tags'

describe('user favorite tags', () => {
  it('parses valid json string and removes duplicates', () => {
    expect(parseStoredFavoriteTagIds('[3, 1, 1, 2]')).toEqual([3, 1, 2])
  })

  it('ignores invalid ids', () => {
    expect(parseStoredFavoriteTagIds('[0, -1, 2.5, \"1\", 9]')).toEqual([1, 9])
  })

  it('returns empty array for invalid json', () => {
    expect(parseStoredFavoriteTagIds('not-json')).toEqual([])
  })

  it('stringifies with normalization', () => {
    expect(stringifyFavoriteTagIds([4, 4, 2, -1] as TagId[])).toBe('[4,2]')
  })
})
