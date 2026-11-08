import type { Document } from '../domain/document.ts'
import {
  type DocumentWeight,
  documentSizes,
  isWorthReducing,
  type ReportWeights,
} from '../domain/document-sizes.ts'
import { Kind } from '../domain/kind.ts'
import type { Report } from '../domain/report.ts'
import { formatOf } from './format.ts'
import { imageAsWritten, type WrittenImage } from './image-as-written.ts'
import type { ImageEncoder } from './image-encoder.ts'
import { reducedPdf } from './reduce-pdf.ts'

/**
 * What the report document holds of each document, worked out once per file added and kept in
 * memory, so that the Review step and saving share it. One document is worked out at a time: an
 * image takes a canvas of tens of megabytes.
 */
export class DocumentsAsWritten {
  private readonly encoder: ImageEncoder
  private readonly images = new WeakMap<Uint8Array, Promise<WrittenImage>>()
  private readonly reductions = new WeakMap<Uint8Array, Promise<Uint8Array | undefined>>()
  /** What reducing gave, for what must be told at once, as a link to the document. */
  private readonly reduced = new WeakMap<Uint8Array, Uint8Array>()
  private last: Promise<unknown> = Promise.resolve()

  constructor(encoder: ImageEncoder) {
    this.encoder = encoder
  }

  private inTurn<T>(task: () => Promise<T>): Promise<T> {
    const next = this.last.then(task)
    this.last = next.catch(() => undefined)
    return next
  }

  /** An image document as the report document holds it. */
  imageOf(document: Document): Promise<WrittenImage> {
    const known = this.images.get(document.content)
    if (known !== undefined) return known
    const image = this.inTurn(() => imageAsWritten(document.content, this.encoder))
    this.images.set(document.content, image)
    return image
  }

  /** A PDF document as the report document holds it: reduced when the Claimant asked. */
  async pdfOf(document: Document): Promise<Uint8Array> {
    return document.isReduced
      ? ((await this.reductionOf(document)) ?? document.content)
      : document.content
  }

  /** The bytes a document's link opens: its reduced file once it is known, or the file added. */
  contentShown(document: Document): Uint8Array {
    return document.isReduced
      ? (this.reduced.get(document.content) ?? document.content)
      : document.content
  }

  /** What reducing a PDF document gives, when that is worth offering. */
  private reductionOf(document: Document): Promise<Uint8Array | undefined> {
    const known = this.reductions.get(document.content)
    if (known !== undefined) return known
    const reduction = this.inTurn(() => this.reduction(document))
    this.reductions.set(document.content, reduction)
    return reduction
  }

  private async reduction(document: Document): Promise<Uint8Array | undefined> {
    const { content } = document
    try {
      const sharesShapes = document.kind !== Kind.bankStatement
      const reduced = await reducedPdf(content, this.encoder, sharesShapes)
      if (!isWorthReducing(content.length, reduced.length)) return undefined
      this.reduced.set(content, reduced)
      return reduced
    } catch {
      // A PDF that cannot be read has nothing to offer; saving says why when it comes to that.
      return undefined
    }
  }

  /** The size of a document, and what reducing it would make it, as the Review step shows them. */
  async weightOf(document: Document): Promise<DocumentWeight> {
    const addedSize = document.content.length
    if (formatOf(document.content) !== 'pdf') {
      const image = await this.imageOf(document)
      return { addedSize, size: image.content.length }
    }
    if (!document.isReduced && !documentSizes.isHeavy(addedSize)) {
      return { addedSize, size: addedSize }
    }
    const reducedSize = (await this.reductionOf(document))?.length
    return {
      addedSize,
      size: document.isReduced ? (reducedSize ?? addedSize) : addedSize,
      reducedSize,
    }
  }

  /** The sizes of a report's documents, and of the report document that `write` writes. */
  async weightsOf(report: Report, write: () => Promise<Uint8Array>): Promise<ReportWeights> {
    const weighed = await Promise.all(
      report.documents.map(async (document) => [document, await this.weightOf(document)] as const),
    )
    const written = await write().catch(() => undefined)
    return { reportDocumentSize: written?.length, weights: new Map(weighed) }
  }
}
