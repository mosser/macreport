import { type LoadOptions, PDFDocument } from '@cantoo/pdf-lib'

/**
 * A PDF as the system reads it, with the empty password: one that opens without a password is read,
 * though a password restricts printing or copying it, as with many bank statements. It rejects a
 * PDF that needs a password to open.
 */
export function loadedPdf(content: Uint8Array, options: LoadOptions = {}): Promise<PDFDocument> {
  return PDFDocument.load(content, { ...options, password: '' })
}
