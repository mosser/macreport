import { describe, expect, it } from 'vitest'
import { ContentScanner, type Token } from './content-scanner.ts'

const bytesOf = (text: string) =>
  Uint8Array.from([...text].map((character) => character.charCodeAt(0)))

function tokensOf(text: string): Token[] {
  const scanner = new ContentScanner(bytesOf(text))
  const tokens: Token[] = []
  for (let token = scanner.next(); token !== undefined; token = scanner.next()) {
    tokens.push(token)
  }
  return tokens
}

const kindsOf = (text: string) => tokensOf(text).map((token) => token.kind)
const sourceOf = (text: string) => tokensOf(text).map((token) => text.slice(token.start, token.end))

describe('ContentScanner', () => {
  it('reads numbers in every form a content stream writes them', () => {
    const tokens = tokensOf('1 -2.5 +3. .5 -.25')
    expect(tokens.map((token) => (token.kind === 'number' ? token.value : undefined))).toEqual([
      1, -2.5, 3, 0.5, -0.25,
    ])
  })

  it('reads an operator, also with a star or a quote', () => {
    const tokens = tokensOf("m f* ' T*")
    expect(tokens.map((token) => (token.kind === 'operator' ? token.text : ''))).toEqual([
      'm',
      'f*',
      "'",
      'T*',
    ])
  })

  it('takes what only looks like a number for an operator', () => {
    expect(kindsOf('4.-1 1e5 . -')).toEqual(['operator', 'operator', 'operator', 'operator'])
  })

  it('reads a name up to the next delimiter', () => {
    expect(sourceOf('/Cs1 cs/P1[')).toEqual(['/Cs1', 'cs', '/P1', '['])
    expect(kindsOf('/Cs1 cs')).toEqual(['name', 'operator'])
  })

  it('reads a string whole, with what would be operators and nested parentheses in it', () => {
    expect(sourceOf('(a f (nested) m) Tj')).toEqual(['(a f (nested) m)', 'Tj'])
  })

  it('does not end a string on an escaped parenthesis', () => {
    expect(sourceOf(String.raw`(a\) b\\) Tj`)).toEqual([String.raw`(a\) b\\)`, 'Tj'])
  })

  it('reads a hexadecimal string whole, and the two angles of a dictionary', () => {
    expect(sourceOf('<00 41> Tj << /MCID 0 >> BDC')).toEqual([
      '<00 41>',
      'Tj',
      '<<',
      '/MCID',
      '0',
      '>>',
      'BDC',
    ])
  })

  it('skips comments and every kind of space', () => {
    expect(sourceOf('1 % a comment f\r\n\t2\f\0m')).toEqual(['1', '2', 'm'])
    expect(sourceOf('% only a comment')).toEqual([])
  })

  it('survives a stream cut short in a string or a hexadecimal string', () => {
    expect(sourceOf('(a (b')).toEqual(['(a (b'])
    expect(sourceOf('<41')).toEqual(['<41'])
  })

  it('reads bytes that are no text as they are', () => {
    const scanner = new ContentScanner(new Uint8Array([0x28, 0x80, 0xff, 0x29, 0x20, 0x66]))
    expect(scanner.next()).toEqual({ kind: 'other', start: 0, end: 4 })
    expect(scanner.next()).toEqual({ kind: 'operator', text: 'f', start: 5, end: 6 })
  })
})
