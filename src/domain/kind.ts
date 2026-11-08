/**
 * What a document is. The kind decides the section a document goes to and the letter of its
 * label; the order of `Kind.all` is the order of the sections in the report document.
 */
export class Kind {
  /** An invoice or an official receipt, added by the Claimant from an expense. */
  static readonly receipt = new Kind('Receipt', 'Receipts', 'R', 'Receipt')
  /** McMaster's form, written by the system for an expense with a missing receipt. */
  static readonly missingReceiptAuthorization = new Kind(
    'Missing receipt authorization',
    'Missing receipt authorizations',
    'M',
    'Missing receipt',
  )
  /** A bank or credit card statement showing the charge, added from an expense. */
  static readonly bankStatement = new Kind('Bank statement', 'Bank statements', 'S', 'Statement')
  /**
   * A document of the report as a whole, which no expense refers to: a travel justification
   * among them.
   */
  static readonly additionalDocument = new Kind(
    'Additional document',
    'Additional documents',
    'A',
    'Additional document',
  )

  /** Every kind, in the order of the sections of the report document. */
  static readonly all: readonly Kind[] = [
    Kind.additionalDocument,
    Kind.receipt,
    Kind.missingReceiptAuthorization,
    Kind.bankStatement,
  ]

  readonly name: string
  readonly plural: string
  readonly letter: string
  /** What the cover calls a document of this kind that supports an expense: Receipt, Statement. */
  readonly coverName: string

  private constructor(name: string, plural: string, letter: string, coverName: string) {
    this.name = name
    this.plural = plural
    this.letter = letter
    this.coverName = coverName
  }
}
