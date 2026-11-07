import { describe, expect, it } from 'vitest'
import { isEmailAddress, textOrAbsent } from './text.ts'

describe('text', () => {
  it('keeps a blank text absent, and a typed one trimmed and composed', () => {
    expect(textOrAbsent('   ')).toBeUndefined()
    expect(textOrAbsent(' Zoë ')).toBe('Zoë')
    expect(textOrAbsent('Zoë')).toBe('Zoë')
  })

  it('recognises an email address', () => {
    expect(isEmailAddress('claimant@mcmaster.ca')).toBe(true)
    expect(isEmailAddress('claimant@mcmaster')).toBe(false)
    expect(isEmailAddress('claimant mcmaster.ca')).toBe(false)
    for (const wrong of [
      '@mcmaster.ca',
      'a@b@mcmaster.ca',
      'a@.ca',
      'a@mcmaster.',
      'a b@mcmaster.ca',
    ]) {
      expect(isEmailAddress(wrong)).toBe(false)
    }
    expect(isEmailAddress('a.b@cas.mcmaster.ca')).toBe(true)
  })
})
