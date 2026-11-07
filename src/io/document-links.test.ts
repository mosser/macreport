import { resolveObjectURL } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { Document } from '../domain/document.ts'
import { Kind } from '../domain/kind.ts'
import { documentLinks } from './document-links.ts'
import { formatOf } from './format.ts'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1])
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 2])
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 3])

describe('documentLinks', () => {
  it('links to the content of a document, shown as its format', async () => {
    const links = documentLinks()
    const urls = [png, jpeg, pdf].map((content) =>
      links.urlOf(new Document(Kind.receipt, 'scan', content)),
    )
    const blobs = urls.map((url) => resolveObjectURL(url))
    expect(blobs.map((blob) => blob?.type)).toEqual(['image/png', 'image/jpeg', 'application/pdf'])
    expect([...new Uint8Array((await blobs[2]?.arrayBuffer()) ?? new ArrayBuffer(0))]).toEqual([
      ...pdf,
    ])
    links.forgetAll()
    expect(urls.map((url) => resolveObjectURL(url))).toEqual([undefined, undefined, undefined])
  })

  it('gives one link per content, however many times and names, until it forgets them', () => {
    const links = documentLinks()
    const scan = new Document(Kind.receipt, 'scan', pdf)
    const url = links.urlOf(scan)
    expect(links.urlOf(scan)).toBe(url)
    expect(links.urlOf(scan.afterNaming('Hotel'))).toBe(url)
    links.forgetAll()
    expect(resolveObjectURL(url)).toBeUndefined()
    expect(links.urlOf(scan)).not.toBe(url)
  })

  it('tells a PDF, a JPEG image and a PNG image apart by their first bytes', () => {
    expect([png, jpeg, pdf].map(formatOf)).toEqual(['png', 'jpeg', 'pdf'])
  })
})
