import { textOrAbsent } from './text.ts'

/** What the Claimant states of a missing receipt. */
export interface MissingReceiptFields {
  readonly reason: string
  readonly paidTo: string
  readonly jobTitle: string
  readonly phoneExtension?: string | undefined
}

/**
 * What an expense states when its Claimant has no receipt: the reason, who was paid and the job
 * title, and the phone extension when the Claimant gives one. The system writes a missing receipt
 * authorization from it.
 */
export class MissingReceipt {
  /** Why the receipt is missing; its line breaks are kept. */
  readonly reason: string
  readonly paidTo: string
  /** What the claimant's job is called, written under Title on the authorization. */
  readonly jobTitle: string
  readonly phoneExtension: string | undefined

  /**
   * Throws a TypeError when the reason, who was paid or the job title is blank: a missing receipt
   * holds them, or is not stated. Texts are kept in their composed form.
   */
  constructor(fields: MissingReceiptFields) {
    const required = (text: string, name: string) => {
      const kept = textOrAbsent(text)
      if (kept === undefined) throw new TypeError(`A missing receipt has ${name}`)
      return kept
    }
    this.reason = required(fields.reason, 'a reason')
    this.paidTo = required(fields.paidTo, 'who was paid')
    this.jobTitle = required(fields.jobTitle, 'a job title')
    this.phoneExtension = textOrAbsent(fields.phoneExtension ?? '')
  }
}
