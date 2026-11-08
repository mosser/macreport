import { describe, expect, it } from 'vitest'
import { charactersNotWritableIn } from './writable-characters.ts'

describe('charactersNotWritableIn', () => {
  it('finds none in the Latin, Greek and Cyrillic alphabets, nor in common punctuation', () => {
    for (const text of [
      'Crédit été É ç ñ ł ő',
      'Ελληνικά',
      'Русский',
      'YYZ–CDG “return” … $ € ·',
    ]) {
      expect(charactersNotWritableIn(text), text).toEqual([])
    }
  })

  it('leaves line breaks and tabs alone: they are not written as characters', () => {
    expect(charactersNotWritableIn('one\ntwo\r\nthree\tfour')).toEqual([])
  })

  it('judges an accent typed as a separate mark as the accented letter', () => {
    expect(charactersNotWritableIn('crédit')).toEqual([])
  })

  it('finds Chinese, Japanese and emoji, each once, in the order they come, a whole emoji at a time', () => {
    expect(charactersNotWritableIn('日本 dinner 日 😀')).toEqual(['日', '本', '😀'])
  })

  it('finds what cannot be seen on screen', () => {
    expect(charactersNotWritableIn('dinner️')).toEqual(['️'])
  })
})
