import type { Amount } from './amount.ts'
import type { CalendarDate } from './calendar-date.ts'
import type { Currency } from './currency.ts'
import type { Document } from './document.ts'
import { Kind } from './kind.ts'
import type { MissingReceipt } from './missing-receipt.ts'

/** What an expense is made of; a field the Claimant has not filled in is absent. */
export interface ExpenseFields {
  readonly date?: CalendarDate | undefined
  readonly description?: string | undefined
  readonly claimedAmount?: Amount | undefined
  readonly isPaidInAnotherCurrency?: boolean | undefined
  readonly foreignAmount?: Amount | undefined
  readonly currency?: Currency | undefined
  readonly receipts?: readonly Document[] | undefined
  readonly bankStatements?: readonly Document[] | undefined
  readonly isPaidInCash?: boolean | undefined
  readonly missingReceipt?: MissingReceipt | undefined
  readonly presetName?: string | undefined
}

/**
 * One transaction claimed: its date, its description, its claimed amount, its foreign amount when
 * it was paid in another currency, its receipt or a missing receipt, and its bank statement unless
 * it was paid in cash.
 * A receipt is a document of the receipt kind, a bank statement a document of the bank statement
 * kind.
 */
export class Expense {
  readonly date: CalendarDate | undefined
  readonly description: string | undefined
  /** In Canadian dollars; an expense paid in another currency may have none. */
  readonly claimedAmount: Amount | undefined
  /** Whether the expense was paid in another currency than the Canadian dollar. */
  readonly isPaidInAnotherCurrency: boolean
  /** The amount of an expense paid in another currency, in that currency, as on its receipt. */
  readonly foreignAmount: Amount | undefined
  /** The currency of an expense paid in another currency. */
  readonly currency: Currency | undefined
  readonly receipts: readonly Document[]
  readonly bankStatements: readonly Document[]
  /** Whether the expense was paid in cash: it then has no bank statement. */
  readonly isPaidInCash: boolean
  /** What is stated when the Claimant has no receipt: the expense then has none. */
  readonly missingReceipt: MissingReceipt | undefined
  /** The name of the expense preset it was added from, if any; nothing else depends on it. */
  readonly presetName: string | undefined

  /**
   * Throws a TypeError when a receipt or a bank statement is a document of another kind, when an
   * expense paid in cash has a bank statement, or when an expense with a missing receipt has a
   * receipt. An expense not paid in another currency has neither a foreign amount nor a currency.
   */
  constructor(fields: ExpenseFields = {}) {
    const receipts = fields.receipts ?? []
    const bankStatements = fields.bankStatements ?? []
    if (receipts.some((document) => document.kind !== Kind.receipt)) {
      throw new TypeError('A receipt is a document of the receipt kind')
    }
    if (bankStatements.some((document) => document.kind !== Kind.bankStatement)) {
      throw new TypeError('A bank statement is a document of the bank statement kind')
    }
    if (fields.isPaidInCash === true && bankStatements.length > 0) {
      throw new TypeError('An expense paid in cash has no bank statement')
    }
    if (fields.missingReceipt !== undefined && receipts.length > 0) {
      throw new TypeError('An expense with a missing receipt has no receipt')
    }
    this.date = fields.date
    this.description = fields.description
    this.claimedAmount = fields.claimedAmount
    this.isPaidInAnotherCurrency = fields.isPaidInAnotherCurrency ?? false
    this.foreignAmount = this.isPaidInAnotherCurrency ? fields.foreignAmount : undefined
    this.currency = this.isPaidInAnotherCurrency ? fields.currency : undefined
    this.receipts = receipts
    this.bankStatements = bankStatements
    this.isPaidInCash = fields.isPaidInCash ?? false
    this.missingReceipt = fields.missingReceipt
    this.presetName = fields.presetName
  }

  /** Whether the expense has at least one receipt. */
  get hasReceipt(): boolean {
    return this.receipts.length > 0
  }

  /** Whether the expense has at least one bank statement. */
  get hasBankStatement(): boolean {
    return this.bankStatements.length > 0
  }

  /** The documents the expense refers to: its receipts, then its bank statements. */
  get documents(): readonly Document[] {
    return [...this.receipts, ...this.bankStatements]
  }

  /**
   * The foreign amount, its currency then its amount as EUR 640.00; empty for an expense paid in
   * Canadian dollars, or until both are given.
   */
  get foreignAmountText(): string {
    const { foreignAmount, currency } = this
    return foreignAmount === undefined || currency === undefined
      ? ''
      : foreignAmount.inCurrency(currency)
  }

  /**
   * The same expense, with the fields given changed. Unticking paid in another currency takes the
   * foreign amount and the currency out.
   */
  afterChanging(changes: ExpenseFields): Expense {
    return new Expense({ ...this.fields(), ...changes })
  }

  /** The same expense, no longer referring to a document; the document itself is left alone. */
  afterRemoving(document: Document): Expense {
    return this.afterChanging({
      receipts: this.receipts.filter((receipt) => receipt !== document),
      bankStatements: this.bankStatements.filter((statement) => statement !== document),
    })
  }

  private fields(): ExpenseFields {
    return {
      date: this.date,
      description: this.description,
      claimedAmount: this.claimedAmount,
      isPaidInAnotherCurrency: this.isPaidInAnotherCurrency,
      foreignAmount: this.foreignAmount,
      currency: this.currency,
      receipts: this.receipts,
      bankStatements: this.bankStatements,
      isPaidInCash: this.isPaidInCash,
      missingReceipt: this.missingReceipt,
      presetName: this.presetName,
    }
  }
}
