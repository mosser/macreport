import { describe, expect, it } from 'vitest'
import { Amount } from './amount.ts'
import { CalendarDate } from './calendar-date.ts'
import { Document } from './document.ts'
import { Expense } from './expense.ts'
import { findingsOf, findingsOfExpensesStep, findingsOfReportStep } from './findings.ts'
import { Kind } from './kind.ts'
import { Report } from './report.ts'

const wordings = (findings: readonly { wording: string }[]) => findings.map((f) => f.wording)

const complete = new Report({
  claimantName: 'Zoë Lefèvre',
  position: 'Faculty',
  email: 'zoe@mcmaster.ca',
  purpose: 'ICSE 2026',
  firstDay: new CalendarDate(2026, 10, 3),
  lastDay: new CalendarDate(2026, 10, 7),
  account: '20-123-456',
})

describe('findings of the Report step', () => {
  it('names each required field missing; the dates are optional', () => {
    expect(wordings(findingsOfReportStep(new Report()))).toEqual([
      'Name of claimant is required.',
      'Position is required.',
      'Email is required.',
      'Purpose is required.',
      'Account is required.',
    ])
    const withoutDates = complete.afterChanging({ firstDay: undefined, lastDay: undefined })
    expect(findingsOfReportStep(withoutDates)).toEqual([])
  })

  it("asks a student or a postdoctoral fellow for their supervisor's name and email", () => {
    for (const position of ['Student', 'Postdoctoral fellow'] as const) {
      expect(wordings(findingsOfReportStep(complete.afterChanging({ position })))).toEqual([
        'Supervisor is required.',
        "Supervisor's email is required.",
      ])
    }
  })

  it("asks a visitor for their host's name and email", () => {
    const visitor = complete.afterChanging({ position: 'Visitor' })
    expect(wordings(findingsOfReportStep(visitor))).toEqual([
      'Host is required.',
      "Host's email is required.",
    ])
  })

  it('refuses a last day before the first', () => {
    const backwards = complete.afterChanging({ lastDay: new CalendarDate(2026, 10, 2) })
    expect(wordings(findingsOfReportStep(backwards))).toEqual(['Last day is before the first day.'])
    expect(findingsOfReportStep(backwards.afterChanging({ firstDay: undefined }))).toEqual([])
    const oneDay = complete.afterChanging({ lastDay: new CalendarDate(2026, 10, 3) })
    expect(findingsOfReportStep(oneDay)).toEqual([])
  })
})

describe('findings of the Expenses step', () => {
  it('finds that no expense is claimed', () => {
    expect(findingsOfExpensesStep(complete)).toEqual([
      { step: 'Expenses', wording: 'No expense is claimed.' },
    ])
  })

  it('names the expense, by its date and description, and the rule', () => {
    expect(wordings(findingsOfExpensesStep(complete.afterAdding(new Expense())))).toEqual([
      'Expense without date, without description: Date is required.',
      'Expense without date, without description: Description is required.',
      'Expense without date, without description: Claimed amount (CAD) is required.',
      'Expense without date, without description: Receipt is required.',
      'Expense without date, without description: Bank statement is required.',
    ])
    const taxi = new Expense({
      date: new CalendarDate(2026, 10, 5),
      description: 'Taxi',
      claimedAmount: new Amount(8710),
      receipts: [new Document(Kind.receipt, 'taxi.pdf', new Uint8Array())],
    })
    expect(wordings(findingsOfExpensesStep(complete.afterAdding(taxi)))).toEqual([
      'Expense 2026-10-05, Taxi: Bank statement is required.',
    ])
  })

  it('gathers the findings of every step', () => {
    expect(findingsOf(new Report()).map((finding) => finding.step)).toEqual([
      ...Array(5).fill('Report'),
      'Expenses',
    ])
  })
})
