import type { Amount } from './amount.ts'
import type { CalendarDate } from './calendar-date.ts'
import type { Document } from './document.ts'
import { Kind } from './kind.ts'

/** What an expense is made of; a field the Claimant has not filled in is absent. */
export interface ExpenseFields {
  readonly date?: CalendarDate | undefined
  readonly description?: string | undefined
  readonly claimedAmount?: Amount | undefined
  readonly receipts?: readonly Document[] | undefined
  readonly bankStatements?: readonly Document[] | undefined
}

/**
 * One transaction claimed: its date, its description, its claimed amount, its receipts and its
 * bank statements. A receipt is a document of the receipt kind, a bank statement a document of
 * the bank statement kind.
 */
export class Expense {
  readonly date: CalendarDate | undefined
  readonly description: string | undefined
  readonly claimedAmount: Amount | undefined
  readonly receipts: readonly Document[]
  readonly bankStatements: readonly Document[]

  /** Throws a TypeError when a receipt or a bank statement is a document of another kind. */
  constructor(fields: ExpenseFields = {}) {
    const receipts = fields.receipts ?? []
    const bankStatements = fields.bankStatements ?? []
    if (receipts.some((document) => document.kind !== Kind.receipt)) {
      throw new TypeError('A receipt is a document of the receipt kind')
    }
    if (bankStatements.some((document) => document.kind !== Kind.bankStatement)) {
      throw new TypeError('A bank statement is a document of the bank statement kind')
    }
    this.date = fields.date
    this.description = fields.description
    this.claimedAmount = fields.claimedAmount
    this.receipts = receipts
    this.bankStatements = bankStatements
  }

  /** Whether the expense has at least one receipt. */
  get hasReceipt(): boolean {
    return this.receipts.length > 0
  }

  /** Whether the expense has at least one bank statement. */
  get hasBankStatement(): boolean {
    return this.bankStatements.length > 0
  }

  /** The same expense, with the fields given changed. */
  afterChanging(changes: ExpenseFields): Expense {
    return new Expense({ ...this.fields(), ...changes })
  }

  private fields(): ExpenseFields {
    return {
      date: this.date,
      description: this.description,
      claimedAmount: this.claimedAmount,
      receipts: this.receipts,
      bankStatements: this.bankStatements,
    }
  }
}
