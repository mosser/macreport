import type { Document } from '../domain/document.ts'
import { html, type Markup } from './html.ts'

/** Links to the content of documents, which the browser opens in a new tab. */
export interface DocumentLinks {
  urlOf(document: Document): string
  /** Lets the browser forget the links given so far. */
  forgetAll(): void
}

/** A link that opens a document in a new tab, its name unless given another text. */
export type LinkOf = (document: Document, text?: string) => Markup

/**
 * Links to documents for a screen about to be shown: the browser forgets the links of the screen
 * shown before, which a tab already opened does not need any more.
 */
export function linksAnew(links: DocumentLinks): LinkOf {
  links.forgetAll()
  return (document, text = document.name) =>
    html`<a href="${links.urlOf(document)}" target="_blank" rel="noopener">${text}</a>`
}

/** The names of documents, one after the other, each a link to its document. */
export function namesOf(documents: readonly Document[], linkOf: LinkOf): Markup[] {
  return documents.flatMap((document, index) => {
    const link = linkOf(document)
    return index === 0 ? [link] : [html` · `, link]
  })
}
