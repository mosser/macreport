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
  /** One link per content, however many times a document is linked to. */
  let urls = new Map<Uint8Array, string>()
  return {
    urlOf(document: Document): string {
      const known = urls.get(document.content)
      if (known !== undefined) return known
      const type = mediaTypes[formatOf(document.content)]
      const url = URL.createObjectURL(
        new Blob([document.content as Uint8Array<ArrayBuffer>], { type }),
      )
      urls.set(document.content, url)
      return url
    },
    forgetAll(): void {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url)
      }
      urls = new Map()
    },
  }
}
