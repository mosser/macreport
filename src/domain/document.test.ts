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

  it('is named after its file, unless the Claimant gives it a name', () => {
    expect(new Document(Kind.receipt, 'scan-0042.pdf', content).name).toBe('scan-0042.pdf')
    expect(new Document(Kind.receipt, 'scan-0042.pdf', content, ' Hotel ').name).toBe('Hotel')
    expect(new Document(Kind.receipt, 'scan-0042.pdf', content, '  ').name).toBe('scan-0042.pdf')
  })

  it('is named otherwise as a copy, keeping its kind, file name and content', () => {
    const scan = new Document(Kind.bankStatement, 'scan-0042.pdf', content)
    const named = scan.afterNaming('Visa, October')
    expect(named).not.toBe(scan)
    expect(named.name).toBe('Visa, October')
    expect(named.kind).toBe(Kind.bankStatement)
    expect(named.fileName).toBe('scan-0042.pdf')
    expect(named.content).toBe(content)
    expect(named.afterNaming('').name).toBe('scan-0042.pdf')
  })
})

describe('Kind', () => {
  it('orders the sections: travel justifications first, additional documents last', () => {
    expect(Kind.all.map((kind) => kind.letter)).toEqual(['J', 'R', 'M', 'S', 'A'])
    expect(Kind.travelJustification.plural).toBe('Travel justifications')
  })
})
