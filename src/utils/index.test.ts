import { describe, expect, it } from 'vitest'
import { getUnmatchedTagNames, mapTagNamesToTagIds, sanitizeAiTagNames } from './index'

const tags = [
  { id: 1, name: 'AI' },
  { id: 2, name: '开发者工具' },
  { id: 3, name: 'CloudBase CLI' },
]

describe('mapTagNamesToTagIds', () => {
  it('supports normalized exact matches', () => {
    const result = mapTagNamesToTagIds([' ai ', '开发者 工具', '"cloudbase cli"'], tags)
    expect(result).toEqual([1, 2, 3])
  })

  it('supports unique partial matches', () => {
    const result = mapTagNamesToTagIds(['开发工具'], tags)
    expect(result).toEqual([2])
  })

  it('skips ambiguous partial matches', () => {
    const result = mapTagNamesToTagIds(
      ['端'],
      [
        { id: 11, name: '前端' },
        { id: 12, name: '后端' },
      ]
    )
    expect(result).toEqual([])
  })

  it('removes duplicate ids', () => {
    const result = mapTagNamesToTagIds(['AI', 'ai', ' AI '], tags)
    expect(result).toEqual([1])
  })

  it('does not over-match short generic terms', () => {
    const result = mapTagNamesToTagIds(['开发'], [{ id: 9, name: '开发者工具' }])
    expect(result).toEqual([])
  })
})

describe('sanitizeAiTagNames', () => {
  it('deduplicates and normalizes ai tag names', () => {
    const result = sanitizeAiTagNames([' " AI " ', 'ai', ' 开发者 工具 ', '', '  '])
    expect(result).toEqual(['AI', '开发者 工具'])
  })
})

describe('getUnmatchedTagNames', () => {
  it('returns only definitely unmatched tag names', () => {
    const result = getUnmatchedTagNames(
      ['AI', '端', '云开发'],
      [
        { id: 11, name: '前端' },
        { id: 12, name: '后端' },
        { id: 13, name: 'AI' },
      ]
    )
    expect(result).toEqual(['云开发'])
  })

  it('can keep unmatched medium-length terms for auto-creation', () => {
    const result = getUnmatchedTagNames(['开发'], [{ id: 9, name: '开发者工具' }])
    expect(result).toEqual(['开发'])
  })

  it('does not drop ambiguous non-exact terms', () => {
    const result = getUnmatchedTagNames(
      ['开发者工具'],
      [
        { id: 1, name: '开发者' },
        { id: 2, name: '工具' },
      ]
    )
    expect(result).toEqual(['开发者工具'])
  })
})
