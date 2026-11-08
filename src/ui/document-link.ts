import type { Document } from '../domain/document.ts'
import type { Expense } from '../domain/expense.ts'
import { fieldNames } from '../domain/findings.ts'
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

/** Pieces of a line, one after the other, separated by a middle dot. */
export function separated(pieces: readonly Markup[]): Markup[] {
  return pieces.flatMap((piece, index) => (index === 0 ? [piece] : [html` · `, piece]))
}

/**
 * What supports an expense, one after the other: each of its documents by its name, a link to it,
 * and Paid in cash where its bank statement would be.
 */
export function supportOf(expense: Expense, linkOf: LinkOf): Markup[] {
  return separated([
    ...expense.documents.map((document) => linkOf(document)),
    ...(expense.isPaidInCash ? [html`${fieldNames.paidInCash}`] : []),
  ])
}
