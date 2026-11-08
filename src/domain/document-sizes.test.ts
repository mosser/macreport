import { describe, expect, it } from 'vitest'
import { DocumentSizes, documentSizes, isWorthReducing, sizeText } from './document-sizes.ts'

const sizes = { heavyDocumentMegabytes: 2, reducedImageMegabytes: 1 }

describe('DocumentSizes', () => {
  it('calls a document heavy above the size configured, not at it', () => {
    const configured = DocumentSizes.from(sizes)
    expect(configured.isHeavy(2_000_000)).toBe(false)
    expect(configured.isHeavy(2_000_001)).toBe(true)
  })

  it('reduces an image above the size configured, not at it', () => {
    const configured = DocumentSizes.from(sizes)
    expect(configured.isImageToReduce(1_000_000)).toBe(false)
    expect(configured.isImageToReduce(1_000_001)).toBe(true)
  })

  it('takes a size of less than a megabyte', () => {
    const configured = DocumentSizes.from({ ...sizes, heavyDocumentMegabytes: 0.5 })
    expect(configured.isHeavy(500_001)).toBe(true)
  })

  it.each([
    ['nothing', undefined],
    ['a text', 'big'],
    ['a size missing', { heavyDocumentMegabytes: 2 }],
    ['a size too many', { ...sizes, other: 3 }],
    ['a size of the wrong type', { ...sizes, heavyDocumentMegabytes: '2' }],
  ])('refuses a configuration holding %s', (_what, configuration) => {
    expect(() => DocumentSizes.from(configuration)).toThrow(TypeError)
  })

  it.each([0, -1, Number.NaN])('refuses a size of %s', (size) => {
    expect(() => DocumentSizes.from({ ...sizes, reducedImageMegabytes: size })).toThrow(RangeError)
  })

  it('reads the sizes of the system from its configuration', () => {
    expect(documentSizes.isHeavy(2_000_001)).toBe(true)
    expect(documentSizes.isHeavy(2_000_000)).toBe(false)
    expect(documentSizes.isImageToReduce(1_000_001)).toBe(true)
    expect(documentSizes.isImageToReduce(1_000_000)).toBe(false)
  })
})

describe('isWorthReducing', () => {
  it('offers reducing that makes a document at least 10 % smaller', () => {
    expect(isWorthReducing(1000, 900)).toBe(true)
    expect(isWorthReducing(1000, 901)).toBe(false)
    expect(isWorthReducing(1000, 1200)).toBe(false)
  })
})

describe('sizeText', () => {
  it('writes a size in kilobytes under a megabyte, and in megabytes from one', () => {
    expect(sizeText(490_000)).toBe('490 KB')
    expect(sizeText(999_499)).toBe('999 KB')
    expect(sizeText(1_000_000)).toBe('1.0 MB')
    expect(sizeText(9_409_039)).toBe('9.4 MB')
  })
})
