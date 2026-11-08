import {
  PDFArray,
  type PDFContext,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  type PDFRef,
} from '@cantoo/pdf-lib'
import { type ImageEncoder, longestSide } from './image-encoder.ts'
import { sizeOfJpeg, withoutColourProfile, withoutExif } from './jpeg.ts'
import { shareShapes } from './shared-shapes.ts'
import { dropUnreachable, leaveOutWhatNoReaderShows } from './unseen-data.ts'

const name = (text: string) => PDFName.of(text)
/**
 * What an image may hold that encoding it again as a plain JPEG would break: a decoder of the JPEG
 * alone sees neither its mask, nor the way the PDF says to decode it.
 */
const unsafeImageKeys = ['SMask', 'Mask', 'Decode', 'DecodeParms', 'ImageMask'].map(name)
const deviceRgb = name('DeviceRGB')
const deviceGrey = name('DeviceGray')

/** The number of components of an ICC colour space, when a colour space is one. */
function iccComponents(colourSpace: unknown, context: PDFContext): number | undefined {
  if (!(colourSpace instanceof PDFArray) || colourSpace.get(0) !== name('ICCBased')) {
    return undefined
  }
  const profile = context.lookup(colourSpace.get(1))
  if (!(profile instanceof PDFRawStream)) return undefined
  return profile.dict.lookupMaybe(name('N'), PDFNumber)?.asNumber()
}

/**
 * Whether the samples of a colour space stay what they mean in a JPEG encoded again, which always
 * holds three components: RGB, by a profile or not, or plain grey. Grey by a profile cannot describe
 * three components, and written as RGB would no longer be read by that profile.
 */
function isPlainColourSpace(value: unknown, context: PDFContext): boolean {
  const colourSpace = context.lookup(value as PDFRef)
  return (
    colourSpace === deviceRgb ||
    colourSpace === deviceGrey ||
    iccComponents(colourSpace, context) === 3
  )
}

/** Whether a stream's only filter is the JPEG one. */
function isJpeg(stream: PDFRawStream, context: PDFContext): boolean {
  const filter = context.lookup(stream.dict.get(name('Filter')))
  const only =
    filter instanceof PDFArray && filter.size() === 1 ? context.lookup(filter.get(0)) : filter
  return only === name('DCTDecode')
}

/** Whether an object is a JPEG in RGB or grey, without a mask, with a long side above the limit. */
function isReducibleImage(object: unknown, context: PDFContext): object is PDFRawStream {
  if (!(object instanceof PDFRawStream)) return false
  const { dict } = object
  if (dict.get(name('Subtype')) !== name('Image') || !isJpeg(object, context)) return false
  if (unsafeImageKeys.some((key) => dict.has(key))) return false
  if (!isPlainColourSpace(dict.get(name('ColorSpace')), context)) return false
  const size = sizeOfJpeg(object.contents)
  return size !== undefined && Math.max(size.width, size.height) > longestSide
}

/** Encodes an image again, in place, when that makes it smaller; it stays as it is otherwise. */
async function reduceImage(
  reference: PDFRef,
  image: PDFRawStream,
  encoder: ImageEncoder,
  context: PDFContext,
): Promise<void> {
  const encoded = await encoder.jpeg(withoutColourProfile(withoutExif(image.contents)))
  const size = sizeOfJpeg(encoded)
  if (size === undefined || encoded.length >= image.contents.length) return
  const dictionary = image.dict.clone(context)
  dictionary.set(name('Width'), PDFNumber.of(size.width))
  dictionary.set(name('Height'), PDFNumber.of(size.height))
  if (context.lookup(dictionary.get(name('ColorSpace'))) === deviceGrey) {
    dictionary.set(name('ColorSpace'), deviceRgb)
  }
  dictionary.set(name('BitsPerComponent'), PDFNumber.of(8))
  dictionary.set(name('Filter'), name('DCTDecode'))
  context.assign(reference, PDFRawStream.of(dictionary, encoded))
}

/**
 * Encodes the images of a PDF one after the other: the pages of a scan, all decoded at once, may not
 * fit in the memory of a browser. An image the browser cannot read stays as it is: larger, and just
 * as readable.
 */
async function reduceImages(pdf: PDFDocument, encoder: ImageEncoder): Promise<void> {
  const { context } = pdf
  const images = context
    .enumerateIndirectObjects()
    .filter(([, object]) => isReducibleImage(object, context))
  await images.reduce(
    (previous, [reference, image]) =>
      previous
        .then(() => reduceImage(reference, image as PDFRawStream, encoder, context))
        .catch(() => undefined),
    Promise.resolve(),
  )
}

/**
 * A heavy PDF document reduced, from the file added: its pages, its text, its links and its form
 * fields stay as they are; what no reader shows is left out, its plain JPEG images are encoded
 * again, and, when asked, the shapes it fills more than once are each kept once. A bank statement's
 * are not: a shape kept apart from its page is out of reach of a reader's redaction tool that only
 * rewrites the page. It rejects a PDF that cannot be read, or is protected.
 */
export async function reducedPdf(
  content: Uint8Array,
  encoder: ImageEncoder,
  sharesShapes: boolean,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(content, { updateMetadata: false })
  leaveOutWhatNoReaderShows(pdf)
  await reduceImages(pdf, encoder)
  if (sharesShapes) {
    shareShapes(pdf)
  }
  dropUnreachable(pdf)
  return pdf.save({ updateFieldAppearances: false })
}
