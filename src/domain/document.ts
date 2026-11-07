import type { Kind } from './kind.ts'

/**
 * A file the Claimant adds to the report: a PDF, a JPEG image or a PNG image, of one kind. Its
 * content is bytes the domain never interprets.
 */
export class Document {
  readonly kind: Kind
  readonly fileName: string
  readonly content: Uint8Array

  /** Throws a TypeError for an empty file name. Texts are kept in their composed form. */
  constructor(kind: Kind, fileName: string, content: Uint8Array) {
    if (fileName.trim() === '') {
      throw new TypeError('A document has a file name')
    }
    this.kind = kind
    this.fileName = fileName.normalize('NFC')
    this.content = content
  }
}
