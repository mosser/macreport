import { describe, expect, it } from 'vitest'
import { Amount } from './amount.ts'
import { CalendarDate } from './calendar-date.ts'
import { Currency } from './currency.ts'
import { Document } from './document.ts'
import { Expense } from './expense.ts'
import { Kind } from './kind.ts'

const receipt = new Document(Kind.receipt, 'receipt.pdf', new Uint8Array())
const statement = new Document(Kind.bankStatement, 'statement.pdf', new Uint8Array())

describe('Expense', () => {
  it('starts with nothing filled in', () => {
    const expense = new Expense()
    expect(expense.date).toBeUndefined()
    expect(expense.hasReceipt).toBe(false)
    expect(expense.hasBankStatement).toBe(false)
  })

  it('refers to a receipt of the receipt kind and a bank statement of the bank statement kind', () => {
    expect(() => new Expense({ receipts: [statement] })).toThrow(TypeError)
    expect(() => new Expense({ bankStatements: [receipt] })).toThrow(TypeError)
    const expense = new Expense({ receipts: [receipt], bankStatements: [statement] })
    expect(expense.hasReceipt).toBe(true)
    expect(expense.hasBankStatement).toBe(true)
  })

  it('changes into a new expense, keeping the fields not changed', () => {
    const expense = new Expense({ description: 'Taxi', receipts: [receipt] })
    const changed = expense.afterChanging({
      date: new CalendarDate(2026, 10, 5),
      claimedAmount: new Amount(8710),
    })
    expect(changed).not.toBe(expense)
    expect(expense.date).toBeUndefined()
    expect(changed.description).toBe('Taxi')
    expect(changed.receipts).toEqual([receipt])
    expect(changed.afterChanging({ description: undefined }).description).toBeUndefined()
  })

  it('has a foreign amount and a currency only while paid in another currency', () => {
    const euro = Currency.parse('EUR')
    const expense = new Expense().afterChanging({
      isPaidInAnotherCurrency: true,
      foreignAmount: new Amount(5500),
    })
    expect(expense.foreignAmountText).toBe('')
    const paid = expense.afterChanging({ currency: euro })
    expect(paid.foreignAmountText).toBe('EUR 55.00')
    const unticked = paid.afterChanging({ isPaidInAnotherCurrency: false })
    expect(unticked.foreignAmount).toBeUndefined()
    expect(unticked.currency).toBeUndefined()
    expect(unticked.foreignAmountText).toBe('')
    expect(new Expense({ foreignAmount: new Amount(1) }).afterChanging({}).foreignAmount).toBe(
      undefined,
    )
  })

  it('stops referring to a document, leaving the others', () => {
    const expense = new Expense({ receipts: [receipt], bankStatements: [statement] })
    expect(expense.documents).toEqual([receipt, statement])
    const without = expense.afterRemoving(statement)
    expect(without.receipts).toEqual([receipt])
    expect(without.hasBankStatement).toBe(false)
    expect(without.afterRemoving(receipt).documents).toEqual([])
  })
})

describe('Document', () => {
  it('has a file name, kept in its composed form', () => {
    expect(() => new Document(Kind.receipt, ' ', new Uint8Array())).toThrow(TypeError)
    expect(new Document(Kind.receipt, 'reçu.pdf', new Uint8Array()).fileName).toBe('reçu.pdf')
  })
})
