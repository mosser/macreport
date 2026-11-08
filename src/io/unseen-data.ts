import { PDFArray, PDFDict, type PDFDocument, PDFName, PDFRef, PDFStream } from '@cantoo/pdf-lib'

/** What a page, or an image or a form it draws, may hold that no reader shows. */
const unseenKeys = ['Thumb', 'PieceInfo', 'Metadata'].map((key) => PDFName.of(key))
const drawnSubtypes = [PDFName.of('Image'), PDFName.of('Form')]
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
  return type === pageType || drawnSubtypes.some((drawn) => drawn === subtype)
}

/**
 * Takes out of a PDF what no reader shows: the thumbnail of each page, the private data of the
 * editor that wrote it, and its metadata, of its pages and of the images and forms they draw.
 */
export function leaveOutWhatNoReaderShows(pdf: PDFDocument): void {
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    const dictionary = dictionaryOf(object)
    if (dictionary !== undefined && isDrawn(dictionary)) {
      for (const key of unseenKeys) {
        dictionary.delete(key)
      }
    }
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
