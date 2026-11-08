import {
  PDFArray,
  type PDFContext,
  PDFDict,
  type PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
} from '@cantoo/pdf-lib'
import { withoutExif } from './jpeg.ts'

/** What a page, or an image or a form it draws, may hold that no reader shows. */
const unseenKeys = ['Thumb', 'PieceInfo', 'Metadata'].map((key) => PDFName.of(key))
const drawnSubtypes = new Set<unknown>([PDFName.of('Image'), PDFName.of('Form')])
const pageType = PDFName.of('Page')

/** The dictionary of an object, itself or that of a stream, when it has one. */
function dictionaryOf(object: unknown): PDFDict | undefined {
  if (object instanceof PDFDict) return object
  return object instanceof PDFStream ? object.dict : undefined
}

/** Whether a dictionary is that of a page, or of an image or a form a page draws. */
function isDrawn(dictionary: PDFDict): boolean {
  const type = dictionary.get(PDFName.of('Type'))
  const subtype = dictionary.get(PDFName.of('Subtype'))
  return type === pageType || drawnSubtypes.has(subtype)
}

/** Whether a stream's only filter is the JPEG one. */
export function isJpeg(stream: PDFRawStream, context: PDFContext): boolean {
  const filter = context.lookup(stream.dict.get(PDFName.of('Filter')))
  const only =
    filter instanceof PDFArray && filter.size() === 1 ? context.lookup(filter.get(0)) : filter
  return only === PDFName.of('DCTDecode')
}

/** Takes the Exif data, a location among it, out of a JPEG image of a PDF. */
function leaveOutExif(reference: PDFRef, object: unknown, context: PDFContext): void {
  const isJpegImage =
    object instanceof PDFRawStream &&
    object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image') &&
    isJpeg(object, context)
  if (!isJpegImage) return
  const kept = withoutExif(object.contents)
  if (kept !== object.contents) {
    context.assign(reference, PDFRawStream.of(object.dict, kept))
  }
}

/**
 * Takes out of a PDF what no reader shows: the thumbnail of each page, the private data of the
 * editor that wrote it, and its metadata, of its pages and of the images and forms they draw, and
 * the Exif data of its JPEG images.
 */
export function leaveOutWhatNoReaderShows(pdf: PDFDocument): void {
  for (const [reference, object] of pdf.context.enumerateIndirectObjects()) {
    const dictionary = dictionaryOf(object)
    if (dictionary !== undefined && isDrawn(dictionary)) {
      for (const key of unseenKeys) {
        dictionary.delete(key)
      }
    }
    leaveOutExif(reference, object, pdf.context)
  }
}

/** What a value of a PDF refers to or holds: the values to look at next. */
function childrenOf(value: unknown, pdf: PDFDocument): readonly unknown[] {
  if (value instanceof PDFRef) return [pdf.context.lookup(value)]
  if (value instanceof PDFArray) return value.asArray()
  const dictionary = dictionaryOf(value)
  return dictionary === undefined ? [] : [...dictionary.values()]
}

/**
 * Deletes from a PDF the objects nothing refers to any more: a PDF is saved with every object it
 * holds, and a document reduced is only as small as what is left.
 */
export function dropUnreachable(pdf: PDFDocument): void {
  const { Root, Info, Encrypt } = pdf.context.trailerInfo
  const reached = new Set<PDFRef>()
  const toVisit: unknown[] = [Root, Info, Encrypt]
  while (toVisit.length > 0) {
    const value = toVisit.pop()
    if (value instanceof PDFRef) {
      if (reached.has(value)) continue
      reached.add(value)
    }
    for (const child of childrenOf(value, pdf)) {
      toVisit.push(child)
    }
  }
  for (const [reference] of pdf.context.enumerateIndirectObjects()) {
    if (!reached.has(reference)) {
      pdf.context.delete(reference)
    }
  }
}
