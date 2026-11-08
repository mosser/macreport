import configured from '../../config/document-sizes.json' with { type: 'json' }
import type { Document } from './document.ts'

const bytesPerMegabyte = 1_000_000
const bytesPerKilobyte = 1_000
/** Reducing is offered when it leaves at most this share of a document. */
const largestShareWorthOffering = 0.9

/** The keys `config/document-sizes.json` holds, each a number of megabytes. */
const configuredKeys = ['heavyDocumentMegabytes', 'reducedImageMegabytes'] as const

/** How much of a document's size goes where, as the Review step shows it. */
export interface DocumentWeight {
  /** The size of the file the Claimant added. */
  readonly addedSize: number
  /** The size of the document in the report document as it stands. */
  readonly size: number
  /** The size of the document once reduced, when reducing is worth offering. */
  readonly reducedSize?: number | undefined
}

/** What the Review step shows of a report's sizes. */
export interface ReportWeights {
  /** The size of the report document, or nothing when it cannot be written. */
  readonly reportDocumentSize: number | undefined
  /** The size of each document of the report. */
  readonly weights: ReadonlyMap<Document, DocumentWeight>
}

/**
 * The sizes that decide how a report document stays small, as `config/document-sizes.json` sets
 * them: above which a document is heavy, and above which an image is reduced.
 */
export class DocumentSizes {
  private readonly heavyDocumentBytes: number
  private readonly reducedImageBytes: number

  private constructor(heavyDocumentMegabytes: number, reducedImageMegabytes: number) {
    this.heavyDocumentBytes = heavyDocumentMegabytes * bytesPerMegabyte
    this.reducedImageBytes = reducedImageMegabytes * bytesPerMegabyte
  }

  /**
   * The sizes a configuration gives, as `config/document-sizes.json` holds them: each a number of
   * megabytes. Throws a TypeError when the configuration holds anything else, or misses a size; a
   * RangeError when a size is not more than zero.
   */
  static from(configuration: unknown): DocumentSizes {
    if (typeof configuration !== 'object' || configuration === null) {
      throw new TypeError('The document sizes are not an object')
    }
    const entries = new Map(Object.entries(configuration))
    if (
      entries.size !== configuredKeys.length ||
      !configuredKeys.every((key) => entries.has(key))
    ) {
      throw new TypeError(`The document sizes hold exactly ${configuredKeys.join(', ')}`)
    }
    const [heavyDocument, reducedImage] = configuredKeys.map((key) =>
      megabytesOf(key, entries.get(key)),
    )
    return new DocumentSizes(heavyDocument ?? 0, reducedImage ?? 0)
  }

  /** Whether a document of this many bytes is heavy. */
  isHeavy(byteCount: number): boolean {
    return byteCount > this.heavyDocumentBytes
  }

  /** Whether an image of this many bytes is reduced when the report document is written. */
  isImageToReduce(byteCount: number): boolean {
    return byteCount > this.reducedImageBytes
  }
}

function megabytesOf(key: string, value: unknown): number {
  if (typeof value !== 'number') {
    throw new TypeError(`The document size ${key} is not a number`)
  }
  if (Number.isNaN(value) || value <= 0) {
    throw new RangeError(`The document size ${key} is not more than zero`)
  }
  return value
}

/** Whether reducing a document of a size to another is worth offering: at least 10 % smaller. */
export function isWorthReducing(size: number, reducedSize: number): boolean {
  return reducedSize <= size * largestShareWorthOffering
}

/** A size as the Claimant reads it: in megabytes with a decimal, or under one in kilobytes. */
export function sizeText(byteCount: number): string {
  return byteCount < bytesPerMegabyte
    ? `${Math.round(byteCount / bytesPerKilobyte)} KB`
    : `${(byteCount / bytesPerMegabyte).toFixed(1)} MB`
}

/** The sizes of the system, from `config/document-sizes.json`, read when the system is built. */
export const documentSizes = DocumentSizes.from(configured)
