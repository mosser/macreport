import { readFileSync } from 'node:fs'
import { PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { RefusedFile } from '../domain/findings.ts'
import { Kind } from '../domain/kind.ts'
import { documentOf } from './add-file.ts'
import { bytesOf } from './inlined.ts'

const png = new Uint8Array(readFileSync('src/assets/mcmaster-col.png'))

async function pdfOf(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  for (let page = 0; page < pageCount; page += 1) pdf.addPage()
  return pdf.save({ addDefaultPage: false })
}

/** A JPEG holding only its header, as much as the report document reads of one. */
const jpeg = new Uint8Array([
  0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 10, 0, 10, 1, 1, 0x11, 0, 0xff, 0xd9,
])

const fileOf = (content: Uint8Array | string, name: string) => new File([content as BlobPart], name)

describe('documentOf', () => {
  it('reads a PDF, a JPEG image and a PNG image into a document of a kind, with its name and its bytes', async () => {
    const pdf = await pdfOf(1)
    const document = await documentOf(fileOf(pdf, 'receipt.pdf'), Kind.receipt)
    expect(document.kind).toBe(Kind.receipt)
    expect(document.fileName).toBe('receipt.pdf')
    expect(document.content).toEqual(pdf)
    expect((await documentOf(fileOf(jpeg, 'photo.jpeg'), Kind.receipt)).fileName).toBe('photo.jpeg')
    expect((await documentOf(fileOf(png, 'scan.png'), Kind.receipt)).fileName).toBe('scan.png')
  })

  it('goes by what a file is, whatever its name says', async () => {
    expect((await documentOf(fileOf(await pdfOf(1), 'receipt.txt'), Kind.receipt)).fileName).toBe(
      'receipt.txt',
    )
    await expect(documentOf(fileOf('plain text', 'receipt.pdf'), Kind.receipt)).rejects.toThrow(
      'receipt.pdf is refused: it is not a PDF, a JPEG image or a PNG image.',
    )
  })

  it('takes a PDF with bytes before its header, as a PDF reader does', async () => {
    const pdf = await pdfOf(1)
    const late = new Uint8Array([10, 10, ...pdf])
    expect((await documentOf(fileOf(late, 'late.pdf'), Kind.receipt)).fileName).toBe('late.pdf')
  })

  it('refuses a damaged PDF', async () => {
    await expect(
      documentOf(fileOf('%PDF-1.7 nothing else', 'a.pdf'), Kind.receipt),
    ).rejects.toThrow('a.pdf is refused: it is damaged.')
  })

  it('refuses a PDF without pages', async () => {
    await expect(documentOf(fileOf(await pdfOf(0), 'a.pdf'), Kind.receipt)).rejects.toThrow(
      'a.pdf is refused: it is a PDF without pages.',
    )
  })

  it('refuses a PDF protected by a password', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage()
    pdf.encrypt({ userPassword: 'secret', ownerPassword: 'secret' })
    await expect(documentOf(fileOf(await pdf.save(), 'a.pdf'), Kind.receipt)).rejects.toThrow(
      'a.pdf is refused: it is protected by a password.',
    )
  })

  it('refuses a damaged image', async () => {
    const pngStart = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0])
    await expect(documentOf(fileOf(pngStart, 'a.png'), Kind.receipt)).rejects.toThrow(
      'a.png is refused: it is damaged.',
    )
    const jpegStart = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    await expect(documentOf(fileOf(jpegStart, 'a.jpeg'), Kind.receipt)).rejects.toThrow(
      'a.jpeg is refused: it is damaged.',
    )
  })

  it('refuses with the error of a refused file', async () => {
    await expect(documentOf(fileOf('text', 'a.txt'), Kind.receipt)).rejects.toBeInstanceOf(
      RefusedFile,
    )
  })
})

describe('bytesOf', () => {
  it('reads the bytes of an inlined data URL', () => {
    expect([...bytesOf('data:application/octet-stream;base64,JVBERg==')]).toEqual([37, 80, 68, 70])
  })
})
