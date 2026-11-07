import type { Document } from '../domain/document.ts'
import { formatOf, mediaTypes } from './format.ts'

/**
 * Links to the content of documents, kept by the browser: opened, a link shows its document in
 * the browser, from the bytes the Claimant added. Nothing crosses a network.
 */
export interface DocumentLinks {
  /** A link to the content of a document. */
  urlOf(document: Document): string
  /** Lets the browser forget every link given so far. */
  forgetAll(): void
}

/** Links to documents, as the browser's object URLs. */
export function documentLinks(): DocumentLinks {
  const urls: string[] = []
  return {
    urlOf(document: Document): string {
      const type = mediaTypes[formatOf(document.content)]
      const url = URL.createObjectURL(
        new Blob([document.content as Uint8Array<ArrayBuffer>], { type }),
      )
      urls.push(url)
      return url
    },
    forgetAll(): void {
      for (const url of urls.splice(0)) {
        URL.revokeObjectURL(url)
      }
    },
  }
}
