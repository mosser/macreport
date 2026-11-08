import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from '@cantoo/pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import type { ImageEncoder } from './image-encoder.ts'
import { sizeOfJpeg } from './jpeg.ts'
import { reducedPdf } from './reduce-pdf.ts'

/** A JPEG of a size, components and bytes, enough to embed and to read the size of. */
function jpegOf(width: number, height: number, size = 40, components = 3): Uint8Array {
  const frame = [0xff, 0xc0, 0, 8 + 3 * components, 8, height >> 8, height & 0xff]
  frame.push(width >> 8, width & 0xff, components)
  for (let index = 1; index <= components; index += 1) frame.push(index, 0x11, 0)
  const head = [0xff, 0xd8, ...frame]
  const bytes = new Uint8Array(Math.max(size, head.length + 4))
  bytes.set(head)
  bytes.set([0xff, 0xda], head.length)
  return bytes
}

/** An encoder reducing to 2200 pixels on the long side, in the few bytes asked. */
function encoderOf(size = 60) {
  const jpeg = vi.fn(async (content: Uint8Array) => {
    const original = sizeOfJpeg(content) ?? { width: 0, height: 0 }
    const scale = Math.min(1, 2200 / Math.max(original.width, original.height))
    return jpegOf(Math.round(original.width * scale), Math.round(original.height * scale), size)
  })
  const encoder: ImageEncoder = { jpeg, png: jpeg }
  return { encoder, jpeg }
}

async function pdfWithImage(image: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const embedded = await pdf.embedJpg(image)
  const page = pdf.addPage([612, 792])
  page.drawImage(embedded, { x: 0, y: 0, width: 612, height: 792 })
  return pdf.save()
}

/** The images of a PDF. */
function imagesOf(pdf: PDFDocument): PDFRawStream[] {
  return pdf.context
    .enumerateIndirectObjects()
    .map(([, object]) => object)
    .filter(
      (object): object is PDFRawStream =>
        object instanceof PDFRawStream &&
        object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
    )
}

const scan = jpegOf(3000, 4000, 200_000)

describe('reducedPdf', () => {
  it('encodes a JPEG too large, and says its new size and format', async () => {
    const { encoder } = encoderOf()
    const reduced = await PDFDocument.load(
      await reducedPdf(await pdfWithImage(scan), encoder, true),
    )
    const [image] = imagesOf(reduced)
    expect(sizeOfJpeg(image?.contents ?? new Uint8Array())).toEqual({ width: 1650, height: 2200 })
    expect(image?.dict.get(PDFName.of('Width'))?.toString()).toBe('1650')
    expect(image?.dict.get(PDFName.of('Height'))?.toString()).toBe('2200')
    expect(image?.dict.get(PDFName.of('ColorSpace'))).toBe(PDFName.of('DeviceRGB'))
    expect(image?.dict.get(PDFName.of('BitsPerComponent'))?.toString()).toBe('8')
  })

  it('leaves out the file of what it encoded: the result is smaller', async () => {
    const original = await pdfWithImage(scan)
    const reduced = await reducedPdf(original, encoderOf().encoder, true)
    expect(reduced.length).toBeLessThan(original.length / 10)
  })

  it('leaves a JPEG within the limit as it is', async () => {
    const { encoder, jpeg } = encoderOf()
    await reducedPdf(await pdfWithImage(jpegOf(2200, 1000, 5000)), encoder, true)
    expect(jpeg).not.toHaveBeenCalled()
  })

  it('leaves an image in CMYK as it is', async () => {
    const { encoder, jpeg } = encoderOf()
    await reducedPdf(await pdfWithImage(jpegOf(3000, 4000, 5000, 4)), encoder, true)
    expect(jpeg).not.toHaveBeenCalled()
  })

  it('reduces an image in grey', async () => {
    const { encoder, jpeg } = encoderOf()
    await reducedPdf(await pdfWithImage(jpegOf(3000, 4000, 5000, 1)), encoder, true)
    expect(jpeg).toHaveBeenCalledOnce()
  })

  it('leaves an image with a mask as it is', async () => {
    const pdf = await PDFDocument.load(await pdfWithImage(scan))
    const [image] = imagesOf(pdf)
    image?.dict.set(PDFName.of('SMask'), pdf.context.register(pdf.context.flateStream('mask')))
    const { encoder, jpeg } = encoderOf()
    await reducedPdf(await pdf.save(), encoder, true)
    expect(jpeg).not.toHaveBeenCalled()
  })

  it('leaves an image that is no JPEG as it is', async () => {
    const pdf = await PDFDocument.create()
    const image = pdf.context.flateStream('pixels', {
      Subtype: 'Image',
      Width: 4000,
      Height: 3000,
      ColorSpace: 'DeviceRGB',
      BitsPerComponent: 8,
    })
    pdf.addPage([612, 792]).node.setXObject(PDFName.of('Im0'), pdf.context.register(image))
    const { encoder, jpeg } = encoderOf()
    await reducedPdf(await pdf.save(), encoder, true)
    expect(jpeg).not.toHaveBeenCalled()
  })

  it('reduces a JPEG in an ICC colour space of 1 or 3 components, and of no other', async () => {
    const withProfile = async (components: number) => {
      const pdf = await PDFDocument.load(await pdfWithImage(scan))
      const profile = pdf.context.register(pdf.context.flateStream('icc', { N: components }))
      imagesOf(pdf)[0]?.dict.set(
        PDFName.of('ColorSpace'),
        pdf.context.obj([PDFName.of('ICCBased'), profile]),
      )
      const { encoder, jpeg } = encoderOf()
      await reducedPdf(await pdf.save(), encoder, true)
      return jpeg.mock.calls.length
    }
    expect(await withProfile(3)).toBe(1)
    expect(await withProfile(1)).toBe(1)
    expect(await withProfile(4)).toBe(0)
  })

  it('takes a filter given as an array of one', async () => {
    const pdf = await PDFDocument.load(await pdfWithImage(scan))
    imagesOf(pdf)[0]?.dict.set(PDFName.of('Filter'), pdf.context.obj([PDFName.of('DCTDecode')]))
    const { encoder, jpeg } = encoderOf()
    await reducedPdf(await pdf.save(), encoder, true)
    expect(jpeg).toHaveBeenCalledOnce()
  })

  it('leaves a JPEG under another filter as it is', async () => {
    const pdf = await PDFDocument.load(await pdfWithImage(scan))
    const filters = pdf.context.obj([PDFName.of('FlateDecode'), PDFName.of('DCTDecode')])
    imagesOf(pdf)[0]?.dict.set(PDFName.of('Filter'), filters)
    const { encoder, jpeg } = encoderOf()
    await reducedPdf(await pdf.save(), encoder, true)
    expect(jpeg).not.toHaveBeenCalled()
  })

  it('keeps an image that encoding does not make smaller', async () => {
    const image = jpegOf(3000, 4000, 100)
    const reduced = await reducedPdf(await pdfWithImage(image), encoderOf(5000).encoder, true)
    const [kept] = imagesOf(await PDFDocument.load(reduced))
    expect(kept?.contents.length).toBe(100)
  })

  it('keeps an image the browser cannot read', async () => {
    const encoder: ImageEncoder = {
      jpeg: async () => {
        throw new TypeError('Cannot read it')
      },
      png: async () => {
        throw new TypeError('Cannot read it')
      },
    }
    const reduced = await reducedPdf(await pdfWithImage(scan), encoder, true)
    expect(imagesOf(await PDFDocument.load(reduced))[0]?.contents.length).toBe(scan.length)
  })

  it('keeps an image an encoder gives no size for', async () => {
    const encoder: ImageEncoder = {
      jpeg: async () => new Uint8Array(10),
      png: async () => new Uint8Array(10),
    }
    const reduced = await reducedPdf(await pdfWithImage(scan), encoder, true)
    expect(imagesOf(await PDFDocument.load(reduced))[0]?.contents.length).toBe(scan.length)
  })

  it('keeps the pages, their sizes, text, links and form fields', async () => {
    const original = await PDFDocument.create()
    const font = await original.embedFont('Helvetica')
    const first = original.addPage([612, 792])
    first.drawText('A programme', { x: 50, y: 700, font, size: 12 })
    original.addPage([595, 842])
    const form = original.getForm()
    form.createCheckBox('entered').addToPage(first, { x: 100, y: 100, width: 10, height: 10 })
    const link = original.context.register(
      original.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [10, 10, 60, 30],
        A: { Type: 'Action', S: 'URI', URI: 'https://example.com' },
      }),
    )
    first.node.addAnnot(link)
    const bytes = await original.save()

    const reduced = await PDFDocument.load(await reducedPdf(bytes, encoderOf().encoder, true))
    expect(reduced.getPages().map((page) => [page.getWidth(), page.getHeight()])).toEqual([
      [612, 792],
      [595, 842],
    ])
    expect(reduced.getForm().getCheckBox('entered')).toBeDefined()
    const annotations = reduced.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray)
    const subtypes = annotations
      .asArray()
      .map((annotation) => reduced.context.lookup(annotation, PDFDict).get(PDFName.of('Subtype')))
    expect(subtypes).toContain(PDFName.of('Link'))
    const content = reduced.context.lookup(reduced.getPage(0).node.get(PDFName.of('Contents')))
    expect(content).toBeDefined()
    const fonts = reduced.getPage(0).node.Resources()?.lookup(PDFName.of('Font'), PDFDict)
    expect(fonts?.keys().length).toBe(1)
  })

  it('leaves out what no reader shows', async () => {
    const original = await PDFDocument.create()
    const page = original.addPage([612, 792])
    const noise = new Uint8Array(100_000).map((_, index) => (index * index * 31) % 251)
    page.node.set(
      PDFName.of('Thumb'),
      original.context.register(original.context.flateStream(noise)),
    )
    const bytes = await original.save()
    expect((await reducedPdf(bytes, encoderOf().encoder, true)).length).toBeLessThan(
      bytes.length / 2,
    )
  })

  describe('the shapes of a PDF', () => {
    const outline = (x: number, y: number) =>
      `${x} ${y} m ${x + 1.5} ${y + 2.5} l ${x + 3} ${y + 2} ${x + 4} ${y + 1} ${x + 5} ${y} c ${x + 2.5} ${y - 1.25} l h f`

    async function pdfWithShapes(): Promise<Uint8Array> {
      const pdf = await PDFDocument.create()
      const page = pdf.addPage([612, 792])
      const content = pdf.context.flateStream(`${outline(10, 20)} ${outline(30, 40)}`)
      page.node.set(PDFName.of('Contents'), pdf.context.register(content))
      return pdf.save()
    }

    const formsOf = (pdf: PDFDocument) =>
      pdf.getPage(0).node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)?.keys().length ??
      0

    it('shares them when asked', async () => {
      const reduced = await reducedPdf(await pdfWithShapes(), encoderOf().encoder, true)
      expect(formsOf(await PDFDocument.load(reduced))).toBe(1)
    })

    it('leaves them on the page otherwise', async () => {
      const reduced = await reducedPdf(await pdfWithShapes(), encoderOf().encoder, false)
      expect(formsOf(await PDFDocument.load(reduced))).toBe(0)
    })
  })

  it('rejects a PDF it cannot read', async () => {
    await expect(reducedPdf(new Uint8Array([1, 2, 3]), encoderOf().encoder, true)).rejects.toThrow()
  })
})
