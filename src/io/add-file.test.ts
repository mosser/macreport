import { describe, expect, it } from 'vitest'
import { Kind } from '../domain/kind.ts'
import { documentOf } from './add-file.ts'
import { bytesOf } from './inlined.ts'

describe('documentOf', () => {
  it('reads a file into a document of a kind, with its name and its bytes', async () => {
    const document = await documentOf(new File(['%PDF'], 'receipt.pdf'), Kind.receipt)
    expect(document.kind).toBe(Kind.receipt)
    expect(document.fileName).toBe('receipt.pdf')
    expect([...document.content]).toEqual([37, 80, 68, 70])
  })
})

describe('bytesOf', () => {
  it('reads the bytes of an inlined data URL', () => {
    expect([...bytesOf('data:application/octet-stream;base64,JVBERg==')]).toEqual([37, 80, 68, 70])
  })
})
