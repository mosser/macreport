import { describe, expect, it } from 'vitest'
import { Document } from './document.ts'
import { Kind } from './kind.ts'

const content = new Uint8Array([1, 2, 3])

describe('Document', () => {
  it('has a file name, in its composed form', () => {
    expect(() => new Document(Kind.receipt, '  ', content)).toThrow(TypeError)
    const decomposed = 'reçu.pdf'
    expect(new Document(Kind.receipt, decomposed, content).fileName).toBe('reçu.pdf')
  })

  it('is named after its file without its extension, unless the Claimant gives it a name', () => {
    expect(new Document(Kind.receipt, 'scan-0042.pdf', content).name).toBe('scan-0042')
    expect(new Document(Kind.receipt, 'scan-0042.pdf', content, ' Hotel ').name).toBe('Hotel')
    expect(new Document(Kind.receipt, 'scan-0042.pdf', content, '  ').name).toBe('scan-0042')
  })

  it('takes only the last extension off its file name, and never all of it', () => {
    const named = (fileName: string) => new Document(Kind.receipt, fileName, content).name
    expect(named('Reçu Café.JPEG')).toBe('Reçu Café')
    expect(named('invoice.2026.png')).toBe('invoice.2026')
    expect(named('statement v1.2')).toBe('statement v1.2')
    expect(named('README')).toBe('README')
    expect(named('.pdf')).toBe('.pdf')
  })

  it('is named otherwise as a copy, keeping its kind, file name and content', () => {
    const scan = new Document(Kind.bankStatement, 'scan-0042.pdf', content)
    const named = scan.afterNaming('Visa, October')
    expect(named).not.toBe(scan)
    expect(named.name).toBe('Visa, October')
    expect(named.kind).toBe(Kind.bankStatement)
    expect(named.fileName).toBe('scan-0042.pdf')
    expect(named.content).toBe(content)
    expect(named.afterNaming('').name).toBe('scan-0042')
  })
})

describe('Kind', () => {
  it('orders the sections: travel justifications first, additional documents last', () => {
    expect(Kind.all.map((kind) => kind.letter)).toEqual(['J', 'R', 'M', 'S', 'A'])
    expect(Kind.travelJustification.plural).toBe('Travel justifications')
  })
})
