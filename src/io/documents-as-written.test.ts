import { PDFDict, PDFDocument, PDFName } from '@cantoo/pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { Document } from '../domain/document.ts'
import { Kind } from '../domain/kind.ts'
import { Report } from '../domain/report.ts'
import { DocumentsAsWritten } from './documents-as-written.ts'
import type { ImageEncoder } from './image-encoder.ts'

const megabyte = 1_000_000

/** An encoder giving a tiny JPEG, and noting how many at a time it was asked for. */
function encoderOf() {
  let running = 0
  let mostAtOnce = 0
  const jpeg = vi.fn(async (_content: Uint8Array) => {
    running += 1
    mostAtOnce = Math.max(mostAtOnce, running)
    await Promise.resolve()
    running -= 1
    return new Uint8Array([0xff, 0xd8, 0xff, 0xda])
  })
  const encoder: ImageEncoder = { jpeg, png: jpeg }
  return { encoder, jpeg, mostAtOnce: () => mostAtOnce }
}

function jpegOf(size: number): Uint8Array {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, 0xff, 0xda])
  return bytes
}

const outline = (x: number, y: number) =>
  `${x} ${y} m ${x + 1.5} ${y + 2.5} l ${x + 3} ${y + 2} ${x + 4} ${y + 1} ${x + 5} ${y} c ${x + 2.5} ${y - 1.25} l h f`

/** Bytes no compression makes smaller. */
function noise(size: number): Uint8Array {
  let seed = 7
  return new Uint8Array(size).map(() => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed >>> 24
  })
}

/** A heavy PDF that reducing makes much smaller: a thumbnail no reader shows, and repeated shapes. */
async function heavyPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const content = pdf.context.flateStream(`${outline(10, 20)}\n${outline(30, 40)}`)
  page.node.set(PDFName.of('Contents'), pdf.context.register(content))
  const thumbnail = pdf.context.flateStream(noise(3 * megabyte))
  page.node.set(PDFName.of('Thumb'), pdf.context.register(thumbnail))
  return pdf.save()
}

const heavy = heavyPdf()

/** A heavy PDF that nothing can reduce: noise the page refers to, and no reader rule covers. */
async function heavyPdfOfNoise(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const stream = pdf.context.flateStream(noise(3 * megabyte), { Subtype: 'Unknown' })
  page.node.set(PDFName.of('Kept'), pdf.context.register(stream))
  return pdf.save()
}

describe('DocumentsAsWritten', () => {
  describe('an image', () => {
    const photo = (size = 3 * megabyte, name = 'photo.jpg') =>
      new Document(Kind.receipt, name, jpegOf(size))

    it('is the file added, however large, and nothing is encoded, until the Claimant asks', async () => {
      const { encoder, jpeg } = encoderOf()
      const documents = new DocumentsAsWritten(encoder)
      const receipt = photo()
      expect((await documents.imageOf(receipt)).content).toBe(receipt.content)
      expect(documents.contentShown(receipt)).toBe(receipt.content)
      expect(jpeg).not.toHaveBeenCalled()
    })

    it('is its reduced file once reduced, and the file added again once restored', async () => {
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const receipt = photo()
      const reduced = receipt.afterReducing()
      const image = await documents.imageOf(reduced)
      expect(image.content).toHaveLength(4)
      expect(image.format).toBe('jpeg')
      expect(documents.contentShown(reduced)).toBe(image.content)
      const restored = reduced.afterRestoring()
      expect((await documents.imageOf(restored)).content).toBe(receipt.content)
      expect(documents.contentShown(restored)).toBe(receipt.content)
    })

    it('is reduced once per file, however many documents have it', async () => {
      const { encoder, jpeg } = encoderOf()
      const documents = new DocumentsAsWritten(encoder)
      const receipt = photo().afterReducing()
      const first = await documents.imageOf(receipt)
      const again = await documents.imageOf(receipt.afterNaming('Hotel'))
      expect(again.content).toBe(first.content)
      expect(jpeg).toHaveBeenCalledOnce()
    })

    it('is reduced one at a time', async () => {
      const { encoder, mostAtOnce } = encoderOf()
      const documents = new DocumentsAsWritten(encoder)
      await Promise.all(
        [1, 2, 3].map((index) =>
          documents.imageOf(photo(undefined, `${index}.jpg`).afterReducing()),
        ),
      )
      expect(mostAtOnce()).toBe(1)
    })

    it('weighs a heavy image, with what reducing would make it', async () => {
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const receipt = photo()
      expect(await documents.weightOf(receipt)).toEqual({
        addedSize: 3 * megabyte,
        size: 3 * megabyte,
        reducedSize: 4,
      })
      expect((await documents.weightOf(receipt.afterReducing())).size).toBe(4)
    })

    it('does not work out reducing for an image that is not heavy', async () => {
      const { encoder, jpeg } = encoderOf()
      const documents = new DocumentsAsWritten(encoder)
      expect(await documents.weightOf(photo(2 * megabyte))).toEqual({
        addedSize: 2 * megabyte,
        size: 2 * megabyte,
      })
      expect(jpeg).not.toHaveBeenCalled()
    })

    it('judges a JPEG without its Exif data', async () => {
      const { encoder, jpeg } = encoderOf()
      const documents = new DocumentsAsWritten(encoder)
      const segment = [0xff, 0xe1, 0xff, 0xff, ...new Array<number>(0xfffd).fill(0)]
      const content = new Uint8Array(2 * megabyte + 100)
      content.set([0xff, 0xd8, ...segment, 0xff, 0xda])
      const weight = await documents.weightOf(new Document(Kind.receipt, 'exif.jpg', content))
      expect(weight.addedSize).toBe(content.length)
      expect(weight.size).toBe(content.length - segment.length)
      expect(jpeg).not.toHaveBeenCalled()
    })

    it('offers nothing when encoding does not make it 10 % smaller, and stays as added', async () => {
      const receipt = photo()
      const notSmaller = jpegOf(2_800_000)
      const documents = new DocumentsAsWritten({
        jpeg: async () => notSmaller,
        png: async () => notSmaller,
      })
      expect((await documents.weightOf(receipt)).reducedSize).toBeUndefined()
      const reduced = receipt.afterReducing()
      expect((await documents.imageOf(reduced)).content).toBe(receipt.content)
      expect(documents.contentShown(reduced)).toBe(receipt.content)
    })

    it('offers nothing when it cannot be encoded, and goes on after it', async () => {
      const documents = new DocumentsAsWritten({
        jpeg: vi
          .fn<ImageEncoder['jpeg']>()
          .mockRejectedValueOnce(new TypeError('Cannot read it'))
          .mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0xda])),
        png: async () => new Uint8Array(),
      })
      const failed = photo(undefined, 'a.jpg')
      expect((await documents.weightOf(failed)).reducedSize).toBeUndefined()
      expect((await documents.imageOf(failed.afterReducing())).content).toBe(failed.content)
      expect((await documents.weightOf(photo(undefined, 'b.jpg'))).reducedSize).toBe(4)
    })
  })

  describe('a PDF', () => {
    it('is the file added until reduced, and its reduced file then', async () => {
      const content = await heavy
      expect(content.length).toBeGreaterThan(2 * megabyte)
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const programme = new Document(Kind.additionalDocument, 'programme.pdf', content)
      expect(await documents.pdfOf(programme)).toBe(content)
      expect(documents.contentShown(programme)).toBe(content)

      const reduced = programme.afterReducing()
      const bytes = await documents.pdfOf(reduced)
      expect(bytes.length).toBeLessThan(content.length / 2)
      expect(documents.contentShown(reduced)).toBe(bytes)
      expect(documents.contentShown(reduced.afterRestoring())).toBe(content)
      expect(await documents.pdfOf(reduced.afterRestoring())).toBe(content)
    })

    it('shows the file added until its reduced file is known', async () => {
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const content = await heavy
      const reduced = new Document(Kind.receipt, 'a.pdf', content, undefined, true)
      expect(documents.contentShown(reduced)).toBe(content)
    })

    it('weighs a heavy PDF, with what reducing would make it', async () => {
      const content = await heavy
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const programme = new Document(Kind.additionalDocument, 'programme.pdf', content)
      const weight = await documents.weightOf(programme)
      expect(weight.addedSize).toBe(content.length)
      expect(weight.size).toBe(content.length)
      expect(weight.reducedSize).toBeLessThan(content.length / 2)
      const reduced = await documents.weightOf(programme.afterReducing())
      expect(reduced.size).toBe(weight.reducedSize)
    })

    it('does not work out reducing for a PDF that is not heavy', async () => {
      const pdf = await PDFDocument.create()
      pdf.addPage([612, 792])
      const content = await pdf.save()
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const receipt = new Document(Kind.receipt, 'small.pdf', content)
      expect(await documents.weightOf(receipt)).toEqual({
        addedSize: content.length,
        size: content.length,
      })
    })

    it('offers nothing for a heavy PDF reducing does not make 10 % smaller', async () => {
      const content = await heavyPdfOfNoise()
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const receipt = new Document(Kind.receipt, 'noise.pdf', content)
      expect(await documents.weightOf(receipt)).toEqual({
        addedSize: content.length,
        size: content.length,
      })
      const reduced = receipt.afterReducing()
      expect(await documents.pdfOf(reduced)).toBe(content)
      expect((await documents.weightOf(reduced)).size).toBe(content.length)
    })

    it('offers nothing for a heavy file that cannot be read as a PDF', async () => {
      const content = new Uint8Array(3 * megabyte)
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const receipt = new Document(Kind.receipt, 'damaged.pdf', content)
      expect((await documents.weightOf(receipt)).reducedSize).toBeUndefined()
    })

    it('keeps the shapes of a bank statement on its pages', async () => {
      const content = await heavy
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const statement = new Document(Kind.bankStatement, 'visa.pdf', content, undefined, true)
      const written = await PDFDocument.load(await documents.pdfOf(statement))
      const forms = written.getPage(0).node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)
      expect(forms?.keys().length ?? 0).toBe(0)
    })

    it('keeps the shapes of a bank statement on its pages, whatever shares its file', async () => {
      const content = await heavy
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const receipt = new Document(Kind.receipt, 'taxi.pdf', content, undefined, true)
      const statement = new Document(Kind.bankStatement, 'visa.pdf', content, undefined, true)
      const reduced = await documents.pdfOf(receipt)
      const kept = await documents.pdfOf(statement)
      expect(kept).not.toBe(reduced)
      expect(documents.contentShown(statement)).toBe(kept)
      expect(documents.contentShown(receipt)).toBe(reduced)
      const written = await PDFDocument.load(kept)
      const forms = written.getPage(0).node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)
      expect(forms?.keys().length ?? 0).toBe(0)
    })

    it('shares the shapes of any other document', async () => {
      const content = await heavy
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const receipt = new Document(Kind.receipt, 'taxi.pdf', content, undefined, true)
      const written = await PDFDocument.load(await documents.pdfOf(receipt))
      const forms = written.getPage(0).node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)
      expect(forms?.keys().length).toBeGreaterThan(0)
    })
  })

  describe('the sizes of a report', () => {
    const report = new Report({
      additionalDocuments: [
        new Document(Kind.additionalDocument, 'photo.jpg', jpegOf(2 * megabyte)),
      ],
    })

    it('gives each document and the report document written', async () => {
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const weights = await documents.weightsOf(report, async () => new Uint8Array(1234))
      expect(weights.reportDocumentSize).toBe(1234)
      expect(weights.weights.get(report.additionalDocuments[0] as Document)?.size).toBe(
        2 * megabyte,
      )
    })

    it('gives no size for a report document that cannot be written', async () => {
      const documents = new DocumentsAsWritten(encoderOf().encoder)
      const weights = await documents.weightsOf(report, async () => {
        throw new TypeError('Damaged')
      })
      expect(weights.reportDocumentSize).toBeUndefined()
      expect(weights.weights.size).toBe(1)
    })
  })
})
