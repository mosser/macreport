import { PDFDict, PDFDocument, PDFName, PDFRawStream } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { dropUnreachable, leaveOutWhatNoReaderShows } from './unseen-data.ts'

const key = (name: string) => PDFName.of(name)

async function pdfWithUnseenData() {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const unseen = () => pdf.context.register(pdf.context.flateStream('unseen'))
  const thumbnail = unseen()
  const pageMetadata = unseen()
  const imageMetadata = unseen()
  const formMetadata = unseen()
  page.node.set(key('Thumb'), thumbnail)
  page.node.set(key('Metadata'), pageMetadata)
  page.node.set(key('PieceInfo'), pdf.context.obj({ Editor: { Private: unseen() } }))
  const image = pdf.context.flateStream('pixels', { Subtype: 'Image', Metadata: imageMetadata })
  const form = pdf.context.flateStream('q Q', {
    Subtype: 'Form',
    Metadata: formMetadata,
    PieceInfo: {},
  })
  const other = pdf.context.flateStream('kept', { Metadata: 'stays' })
  const references = {
    image: pdf.context.register(image),
    form: pdf.context.register(form),
    other: pdf.context.register(other),
  }
  page.node.setXObject(key('Im0'), references.image)
  page.node.setXObject(key('Fm0'), references.form)
  return { pdf, page, image, form, other, references, thumbnail, pageMetadata, imageMetadata }
}

describe('leaveOutWhatNoReaderShows', () => {
  it('takes the thumbnail, the private data and the metadata out of a page', async () => {
    const { pdf, page } = await pdfWithUnseenData()
    leaveOutWhatNoReaderShows(pdf)
    expect(page.node.get(key('Thumb'))).toBeUndefined()
    expect(page.node.get(key('Metadata'))).toBeUndefined()
    expect(page.node.get(key('PieceInfo'))).toBeUndefined()
  })

  it('takes them out of what a page draws, and leaves other streams as they are', async () => {
    const { pdf, image, form, other } = await pdfWithUnseenData()
    leaveOutWhatNoReaderShows(pdf)
    expect(image.dict.has(key('Metadata'))).toBe(false)
    expect(form.dict.has(key('Metadata'))).toBe(false)
    expect(form.dict.has(key('PieceInfo'))).toBe(false)
    expect(other.dict.has(key('Metadata'))).toBe(true)
  })

  describe('of a JPEG image', () => {
    const exif = [0xff, 0xe1, 0, 8, ...new TextEncoder().encode('Exif'), 0, 0]
    const rest = [0xff, 0xc0, 0, 2, 0xff, 0xda, 1, 2, 3]
    const jpeg = new Uint8Array([0xff, 0xd8, ...exif, ...rest])
    const withoutIt = [0xff, 0xd8, ...rest]

    /** The bytes of a stream of a PDF once what no reader shows is left out. */
    async function bytesAfter(dictionary: Record<string, unknown>): Promise<number[]> {
      const pdf = await PDFDocument.create()
      const reference = pdf.context.register(
        pdf.context.stream(jpeg, dictionary as Parameters<typeof pdf.context.stream>[1]),
      )
      leaveOutWhatNoReaderShows(pdf)
      const stream = pdf.context.lookup(reference)
      if (!(stream instanceof PDFRawStream)) throw new TypeError('No stream')
      return [...stream.contents]
    }

    it('takes the Exif data out, and nothing else', async () => {
      expect(await bytesAfter({ Subtype: 'Image', Filter: 'DCTDecode', Width: 5 })).toEqual(
        withoutIt,
      )
    })

    it('takes it out under a filter given as an array of one', async () => {
      expect(await bytesAfter({ Subtype: 'Image', Filter: ['DCTDecode'] })).toEqual(withoutIt)
    })

    it('leaves bytes it cannot read, under another filter or not an image, as they are', async () => {
      const filters = ['FlateDecode', 'DCTDecode']
      expect(await bytesAfter({ Subtype: 'Image', Filter: filters })).toEqual([...jpeg])
      expect(await bytesAfter({ Filter: 'DCTDecode' })).toEqual([...jpeg])
    })
  })

  it('keeps what the page shows', async () => {
    const { pdf, page, references } = await pdfWithUnseenData()
    const contents = page.node.get(key('Contents'))
    leaveOutWhatNoReaderShows(pdf)
    expect(page.node.get(key('Contents'))).toBe(contents)
    const objects = page.node.Resources()?.lookup(key('XObject'), PDFDict)
    expect(objects?.get(key('Im0'))).toBe(references.image)
  })
})

describe('dropUnreachable', () => {
  it('deletes what nothing refers to any more, what it alone refers to with it', async () => {
    const { pdf, thumbnail, pageMetadata } = await pdfWithUnseenData()
    const stale = pdf.context.register(pdf.context.obj({ Next: thumbnail }))
    leaveOutWhatNoReaderShows(pdf)
    dropUnreachable(pdf)
    expect(pdf.context.lookup(stale)).toBeUndefined()
    expect(pdf.context.lookup(thumbnail)).toBeUndefined()
    expect(pdf.context.lookup(pageMetadata)).toBeUndefined()
  })

  it('keeps pages, what they draw, the document information and references that loop', async () => {
    const { pdf, page, references } = await pdfWithUnseenData()
    pdf.setTitle('A title')
    const looping = pdf.context.obj({}) as PDFDict
    const loopingReference = pdf.context.register(looping)
    looping.set(key('Self'), loopingReference)
    page.node.set(key('Looping'), loopingReference)
    dropUnreachable(pdf)
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.context.lookup(references.image)).toBeInstanceOf(PDFRawStream)
    expect(pdf.context.lookup(loopingReference)).toBe(looping)
    expect(pdf.getTitle()).toBe('A title')
  })

  it('makes the file saved smaller', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage([612, 792])
    const noise = new Uint8Array(100_000).map((_, index) => (index * index * 31) % 251)
    pdf.context.register(pdf.context.flateStream(noise))
    const before = (await pdf.save()).length
    dropUnreachable(pdf)
    expect((await pdf.save()).length).toBeLessThan(before / 2)
  })
})
