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
import { imageAsAdded, imageReduced, reducedImage, type WrittenImage } from './image-as-written.ts'
import type { ImageEncoder } from './image-encoder.ts'
import { reducedPdf } from './reduce-pdf.ts'

/** What reducing gives in one way, by the file added. */
class Reductions {
  readonly known = new WeakMap<Uint8Array, Promise<Uint8Array | undefined>>()
  /** What reducing gave, for what must be told at once, as a link to the document. */
  readonly reduced = new WeakMap<Uint8Array, Uint8Array>()
}

/** Whether reducing a document shares its shapes: a bank statement's stay on its pages. */
function sharesShapes(document: Document): boolean {
  return document.kind !== Kind.bankStatement
}

/**
 * What the report document holds of each document, worked out once per file added and kept in
 * memory, so that the Review step and saving share it. One document is reduced at a time: an image
 * takes a canvas of tens of megabytes.
 */
export class DocumentsAsWritten {
  private readonly encoder: ImageEncoder
  private readonly images = new WeakMap<Uint8Array, WrittenImage>()
  private readonly sharingShapes = new Reductions()
  private readonly keepingShapes = new Reductions()
  private last: Promise<unknown> = Promise.resolve()

  constructor(encoder: ImageEncoder) {
    this.encoder = encoder
  }

  private reductionsFor(document: Document): Reductions {
    return sharesShapes(document) ? this.sharingShapes : this.keepingShapes
  }

  private inTurn<T>(task: () => Promise<T>): Promise<T> {
    const next = this.last.then(task)
    this.last = next.catch(() => undefined)
    return next
  }

  /** An image as added, without its Exif data. */
  private imageAsAdded(content: Uint8Array): WrittenImage {
    const known = this.images.get(content)
    if (known !== undefined) return known
    const image = imageAsAdded(content)
    this.images.set(content, image)
    return image
  }

  /** An image document as the report document holds it: reduced when the Claimant asked. */
  async imageOf(document: Document): Promise<WrittenImage> {
    const reduced = document.isReduced ? await this.reductionOf(document) : undefined
    return reduced === undefined
      ? this.imageAsAdded(document.content)
      : imageReduced(document.content, reduced)
  }

  /** The size of a document when it is not reduced: that of the file added, an image without Exif. */
  private sizeAsAdded({ content }: Document): number {
    return formatOf(content) === 'pdf' ? content.length : this.imageAsAdded(content).content.length
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
      ? (this.reductionsFor(document).reduced.get(document.content) ?? document.content)
      : document.content
  }

  /** What reducing a document gives, when that is worth offering. */
  private reductionOf(document: Document): Promise<Uint8Array | undefined> {
    const { known } = this.reductionsFor(document)
    const found = known.get(document.content)
    if (found !== undefined) return found
    const reduction = this.inTurn(() => this.reduction(document))
    known.set(document.content, reduction)
    return reduction
  }

  private async reduction(document: Document): Promise<Uint8Array | undefined> {
    const { content } = document
    try {
      const reduced =
        formatOf(content) === 'pdf'
          ? await reducedPdf(content, this.encoder, sharesShapes(document))
          : await reducedImage(content, this.encoder)
      if (!isWorthReducing(this.sizeAsAdded(document), reduced.length)) return undefined
      this.reductionsFor(document).reduced.set(content, reduced)
      return reduced
    } catch {
      // A file that cannot be read has nothing to offer; saving says why when it comes to that.
      return undefined
    }
  }

  /** The size of a document, and what reducing it would make it, as the Review step shows them. */
  async weightOf(document: Document): Promise<DocumentWeight> {
    const addedSize = document.content.length
    const size = this.sizeAsAdded(document)
    if (!document.isReduced && !documentSizes.isHeavy(size)) {
      return { addedSize, size }
    }
    const reducedSize = (await this.reductionOf(document))?.length
    return { addedSize, size: document.isReduced ? (reducedSize ?? size) : size, reducedSize }
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
