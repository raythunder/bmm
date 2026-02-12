import { describe, expect, it } from 'vitest'
import { normalizeUserAiBatchJobErrorMessage } from './user-ai-batch-errors'

describe('normalizeUserAiBatchJobErrorMessage', () => {
  it('keeps short messages unchanged', () => {
    expect(normalizeUserAiBatchJobErrorMessage('普通错误')).toBe('普通错误')
  })

  it('truncates long messages to 500 chars', () => {
    const input = 'a'.repeat(1000)
    const output = normalizeUserAiBatchJobErrorMessage(input)
    expect(output.length).toBe(500)
    expect(output.endsWith('...')).toBe(true)
  })
})
