import type { Kind } from './kind.ts'
import { textOrAbsent } from './text.ts'

/** An extension ending a file name: a dot, then letters and digits starting with a letter. */
const extension = /(?<=.)\.\p{L}[\p{L}\p{N}]*$/u

/**
 * A file the Claimant adds to the report: a PDF, a JPEG image or a PNG image, of one kind, with a
 * name. Its content is bytes the domain never interprets.
 */
export class Document {
  readonly kind: Kind
  readonly fileName: string
  /**
   * What the document is called in the report: its file name without its extension, unless the
   * Claimant gives another.
   */
  readonly name: string
  readonly content: Uint8Array

  /**
   * Throws a TypeError for an empty file name. A name absent or empty is the file name without
   * its extension (.pdf, .jpeg, .png). Texts are kept in their composed form.
   */
  constructor(kind: Kind, fileName: string, content: Uint8Array, name?: string) {
    if (fileName.trim() === '') {
      throw new TypeError('A document has a file name')
    }
    this.kind = kind
    this.fileName = fileName.normalize('NFC')
    this.name = textOrAbsent(name ?? '') ?? this.fileName.replace(extension, '')
    this.content = content
  }

  /** The same document, named otherwise; a name left empty is the file name, without extension. */
  afterNaming(name: string): Document {
    return new Document(this.kind, this.fileName, this.content, name)
  }
}
