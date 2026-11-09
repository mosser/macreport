import { readFileSync } from 'node:fs'
import { PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { RefusedFile } from '../domain/findings.ts'
import { Kind } from '../domain/kind.ts'
import { addedFileOf } from './add-file.ts'
import { bytesOf } from './inlined.ts'

const png = new Uint8Array(readFileSync('src/assets/mcmaster-col.png'))

async function pdfOf(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  for (let page = 0; page < pageCount; page += 1) pdf.addPage()
  return pdf.save({ addDefaultPage: false })
}

/** The start of a JPEG, up to its frame: what the report document reads of one. */
const jpegHeader = [0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 10, 0, 10, 1, 1, 0x11, 0]
/** The start of its scan, with a little of what it holds. */
const jpegScan = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 1, 2, 3]
const jpegEnd = [0xff, 0xd9]
const jpeg = new Uint8Array([...jpegHeader, ...jpegScan, ...jpegEnd])

const fileOf = (content: Uint8Array | string, name: string) => new File([content as BlobPart], name)

describe('addedFileOf', () => {
  it('reads a PDF, a JPEG image and a PNG image into a document of a kind, with its name and its bytes', async () => {
    const pdf = await pdfOf(1)
    const { document } = await addedFileOf(fileOf(pdf, 'receipt.pdf'), Kind.receipt)
    expect(document.kind).toBe(Kind.receipt)
    expect(document.fileName).toBe('receipt.pdf')
    expect(document.content).toEqual(pdf)
    expect((await addedFileOf(fileOf(jpeg, 'photo.jpeg'), Kind.receipt)).document.fileName).toBe(
      'photo.jpeg',
    )
    expect((await addedFileOf(fileOf(png, 'scan.png'), Kind.receipt)).document.fileName).toBe(
      'scan.png',
    )
  })

  it('goes by what a file is, whatever its name says', async () => {
    expect(
      (await addedFileOf(fileOf(await pdfOf(1), 'receipt.txt'), Kind.receipt)).document.fileName,
    ).toBe('receipt.txt')
    await expect(addedFileOf(fileOf('plain text', 'receipt.pdf'), Kind.receipt)).rejects.toThrow(
      'receipt.pdf is refused: it is not a PDF, a JPEG image or a PNG image.',
    )
  })

  it('says that nothing was unlocked of a PDF that no password restricts, or of an image', async () => {
    expect((await addedFileOf(fileOf(await pdfOf(1), 'a.pdf'), Kind.receipt)).wasUnlocked).toBe(
      false,
    )
    expect((await addedFileOf(fileOf(png, 'a.png'), Kind.receipt)).wasUnlocked).toBe(false)
  })

  it('takes a PDF with bytes before its header, as a PDF reader does', async () => {
    const pdf = await pdfOf(1)
    const late = new Uint8Array([10, 10, ...pdf])
    expect((await addedFileOf(fileOf(late, 'late.pdf'), Kind.receipt)).document.fileName).toBe(
      'late.pdf',
    )
  })

  it('refuses a damaged PDF', async () => {
    await expect(
      addedFileOf(fileOf('%PDF-1.7 nothing else', 'a.pdf'), Kind.receipt),
    ).rejects.toThrow('a.pdf is refused: it is damaged.')
  })

  it('refuses a PDF without pages', async () => {
    await expect(addedFileOf(fileOf(await pdfOf(0), 'a.pdf'), Kind.receipt)).rejects.toThrow(
      'a.pdf is refused: it is a PDF without pages.',
    )
  })

  it('takes a PDF that opens without a password, though one restricts it', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage()
    pdf.encrypt({ userPassword: '', ownerPassword: 'owner' })
    const restricted = await pdf.save()
    const { document, wasUnlocked } = await addedFileOf(
      fileOf(restricted, 'visa.pdf'),
      Kind.bankStatement,
    )
    expect(document.fileName).toBe('visa.pdf')
    expect(document.content).toEqual(restricted)
    expect(wasUnlocked).toBe(true)
  })

  it('refuses a PDF that needs a password to open', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage()
    pdf.encrypt({ userPassword: 'secret', ownerPassword: 'secret' })
    await expect(addedFileOf(fileOf(await pdf.save(), 'a.pdf'), Kind.receipt)).rejects.toThrow(
      'a.pdf is refused: it needs a password to open.',
    )
  })

  it('refuses a damaged image', async () => {
    const pngStart = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0])
    await expect(addedFileOf(fileOf(pngStart, 'a.png'), Kind.receipt)).rejects.toThrow(
      'a.png is refused: it is damaged.',
    )
    const jpegStart = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    await expect(addedFileOf(fileOf(jpegStart, 'a.jpeg'), Kind.receipt)).rejects.toThrow(
      'a.jpeg is refused: it is damaged.',
    )
  })

  it('refuses a JPEG cut short: without its image, or before the end of it', async () => {
    for (const cut of [jpegHeader, [...jpegHeader, ...jpegScan], [...jpegHeader, ...jpegEnd]]) {
      await expect(
        addedFileOf(fileOf(new Uint8Array(cut), 'a.jpeg'), Kind.receipt),
      ).rejects.toThrow('a.jpeg is refused: it is damaged.')
    }
  })

  it('takes a JPEG with bytes after its end, as some cameras write', async () => {
    const trailing = new Uint8Array([...jpeg, 1, 2, 3])
    expect((await addedFileOf(fileOf(trailing, 'a.jpeg'), Kind.receipt)).document.fileName).toBe(
      'a.jpeg',
    )
  })

  it('refuses with the error of a refused file', async () => {
    await expect(addedFileOf(fileOf('text', 'a.txt'), Kind.receipt)).rejects.toBeInstanceOf(
      RefusedFile,
    )
  })
})

describe('bytesOf', () => {
  it('reads the bytes of an inlined data URL', () => {
    expect([...bytesOf('data:application/octet-stream;base64,JVBERg==')]).toEqual([37, 80, 68, 70])
  })
})
