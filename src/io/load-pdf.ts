import { type LoadOptions, PDFDocument } from '@cantoo/pdf-lib'

/**
 * A PDF as the system reads it, with the empty password: one that opens without a password is read,
 * though a password restricts printing or copying it, as with many bank statements. It rejects a
 * PDF that needs a password to open.
 */
export function loadedPdf(content: Uint8Array, options: LoadOptions = {}): Promise<PDFDocument> {
  return PDFDocument.load(content, { ...options, password: '' })
}

/**
 * Whether a PDF had to be unlocked to be read: a password restricts it, though it opens without one.
 * It rejects a PDF that cannot be read, or needs a password to open.
 */
export async function isUnlockedOnReading(content: Uint8Array): Promise<boolean> {
  const pdf = await PDFDocument.load(content, { ignoreEncryption: true })
  const opened = pdf.isEncrypted ? await loadedPdf(content) : pdf
  if (opened.getPageCount() === 0) throw new PdfWithoutPages()
  return pdf.isEncrypted
}

/** A PDF that opens, and holds no page. */
export class PdfWithoutPages extends Error {
  constructor() {
    super('A PDF without pages')
    this.name = 'PdfWithoutPages'
  }
}
