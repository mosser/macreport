import { describe, expect, it } from 'vitest'
import { Amount } from './amount.ts'
import { CalendarDate } from './calendar-date.ts'
import { Currency } from './currency.ts'
import { Document } from './document.ts'
import { Expense } from './expense.ts'
import { Kind } from './kind.ts'
import { MissingReceipt } from './missing-receipt.ts'

const receipt = new Document(Kind.receipt, 'receipt.pdf', new Uint8Array())
const statement = new Document(Kind.bankStatement, 'statement.pdf', new Uint8Array())

describe('Expense', () => {
  it('remembers the preset it was added from, as it changes', () => {
    expect(new Expense().presetName).toBeUndefined()
    const added = new Expense({ description: 'Hotel', presetName: 'Travel planning' })
    expect(added.afterChanging({ description: 'Inn' }).presetName).toBe('Travel planning')
  })

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
    const constructed = new Expense({ foreignAmount: new Amount(1), currency: euro })
    expect(constructed.foreignAmount).toBeUndefined()
    expect(constructed.currency).toBeUndefined()
    expect(constructed.foreignAmountText).toBe('')
  })

  it('is not paid in cash unless it says so, and then has no bank statement', () => {
    expect(new Expense().isPaidInCash).toBe(false)
    expect(new Expense({ isPaidInCash: true }).isPaidInCash).toBe(true)
    expect(() => new Expense({ isPaidInCash: true, bankStatements: [statement] })).toThrow(
      new TypeError('An expense paid in cash has no bank statement'),
    )
    expect(() =>
      new Expense({ bankStatements: [statement] }).afterChanging({ isPaidInCash: true }),
    ).toThrow(TypeError)
  })

  it('stays paid in cash through any other change, until that is taken back', () => {
    const paid = new Expense({ receipts: [receipt], isPaidInCash: true })
    expect(paid.afterChanging({ description: 'Taxi' }).isPaidInCash).toBe(true)
    expect(paid.afterRemoving(receipt).isPaidInCash).toBe(true)
    const back = paid.afterChanging({ isPaidInCash: false })
    expect(back.isPaidInCash).toBe(false)
    expect(back.afterChanging({ bankStatements: [statement] }).hasBankStatement).toBe(true)
  })

  it('has no missing receipt unless one is stated, and then has no receipt', () => {
    const missing = new MissingReceipt({ reason: 'Lost', paidTo: 'Taxi', jobTitle: 'PhD Student' })
    expect(new Expense().missingReceipt).toBeUndefined()
    expect(new Expense({ missingReceipt: missing }).missingReceipt).toBe(missing)
    expect(() => new Expense({ missingReceipt: missing, receipts: [receipt] })).toThrow(
      new TypeError('An expense with a missing receipt has no receipt'),
    )
  })

  it('keeps its missing receipt through any other change, until that is taken back', () => {
    const missing = new MissingReceipt({ reason: 'Lost', paidTo: 'Taxi', jobTitle: 'PhD Student' })
    const stated = new Expense({ missingReceipt: missing, bankStatements: [statement] })
    expect(stated.afterChanging({ description: 'Taxi' }).missingReceipt).toBe(missing)
    expect(stated.afterRemoving(statement).missingReceipt).toBe(missing)
    const back = stated.afterChanging({ missingReceipt: undefined })
    expect(back.missingReceipt).toBeUndefined()
    expect(back.afterChanging({ receipts: [receipt] }).hasReceipt).toBe(true)
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
