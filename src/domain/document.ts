import type { Kind } from './kind.ts'
import { textOrAbsent } from './text.ts'

/** An extension ending a file name: a dot, then letters and digits starting with a letter. */
const extension = /(?<=.)\.\p{L}[\p{L}\p{N}]*$/u

/** A file the Claimant added: its document, and whether it had to be unlocked to be read. */
export interface AddedFile {
  readonly document: Document
  /** Whether a password restricted it, though it opens without one. */
  readonly wasUnlocked: boolean
}

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
   * Whether the Claimant reduced the document. Its content stays the file added: what reducing
   * gives is worked out from it when needed, and Restore brings the file added back.
   */
  readonly isReduced: boolean

  /**
   * Throws a TypeError for an empty file name. A name absent or empty is the file name without
   * its extension (.pdf, .jpeg, .png). Texts are kept in their composed form.
   */
  constructor(kind: Kind, fileName: string, content: Uint8Array, name?: string, isReduced = false) {
    if (fileName.trim() === '') {
      throw new TypeError('A document has a file name')
    }
    this.kind = kind
    this.fileName = fileName.normalize('NFC')
    this.name = textOrAbsent(name ?? '') ?? this.fileName.replace(extension, '')
    this.content = content
    this.isReduced = isReduced
  }

  /** Whether the other document has the same content, byte for byte, whatever its name. */
  hasSameContentAs(other: Document): boolean {
    const { content } = this
    return (
      content === other.content ||
      (content.length === other.content.length &&
        content.every((byte, index) => byte === other.content[index]))
    )
  }

  /** The same document, named otherwise; a name left empty is the file name, without extension. */
  afterNaming(name: string): Document {
    return new Document(this.kind, this.fileName, this.content, name, this.isReduced)
  }

  /** The same document, reduced as the Claimant asked. */
  afterReducing(): Document {
    return new Document(this.kind, this.fileName, this.content, this.name, true)
  }

  /** The same document, back to the file the Claimant added. */
  afterRestoring(): Document {
    return new Document(this.kind, this.fileName, this.content, this.name, false)
  }
}
