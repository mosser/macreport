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
  event: 'ICSE 2026',
  firstDay: new CalendarDate(2026, 10, 3),
  lastDay: new CalendarDate(2026, 10, 7),
  account: '20-123-456',
})

describe('findings of the Report step', () => {
  it('names each required field missing, and what it needs', () => {
    expect(wordings(findingsOfReportStep(new Report()))).toEqual([
      'Name of claimant: Required.',
      'Position: Required, one of Faculty, Postdoctoral fellow, Student, Staff, Visitor.',
      'Email: Required, an email address.',
      'Event: Required.',
      'First day of the event: Required, a calendar date.',
      'Last day of the event: Required, a calendar date, not before the first day.',
      'Account: Required, free text.',
    ])
  })

  it("asks a student for their supervisor's name and email", () => {
    const student = complete.afterChanging({ position: 'Student' })
    expect(wordings(findingsOfReportStep(student))).toEqual([
      "Supervisor: Required: the supervisor's name.",
      "Supervisor's email: Required, an email address.",
    ])
  })

  it("asks a visitor for their host's name and email", () => {
    const visitor = complete.afterChanging({ position: 'Visitor' })
    expect(wordings(findingsOfReportStep(visitor))).toEqual([
      "Host: Required: the host's name.",
      "Host's email: Required, an email address.",
    ])
  })

  it('refuses a last day before the first', () => {
    const backwards = complete.afterChanging({ lastDay: new CalendarDate(2026, 10, 2) })
    expect(wordings(findingsOfReportStep(backwards))).toEqual([
      'Last day of the event: Required, a calendar date, not before the first day.',
    ])
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
      'Expense without date, without description: Date: Required, a calendar date.',
      'Expense without date, without description: Description: Required. For a meal not only for the claimant, it lists the attendees and their affiliations.',
      'Expense without date, without description: Claimed amount (CAD): Required, in Canadian dollars, more than zero, at most two decimals.',
      'Expense without date, without description: Receipt: Required, a PDF, a JPEG image or a PNG image.',
      'Expense without date, without description: Bank statement: Required, a PDF, a JPEG image or a PNG image.',
    ])
    const taxi = new Expense({
      date: new CalendarDate(2026, 10, 5),
      description: 'Taxi',
      claimedAmount: new Amount(8710),
      receipts: [new Document(Kind.receipt, 'taxi.pdf', new Uint8Array())],
    })
    expect(wordings(findingsOfExpensesStep(complete.afterAdding(taxi)))).toEqual([
      'Expense 2026-10-05, Taxi: Bank statement: Required, a PDF, a JPEG image or a PNG image.',
    ])
  })

  it('gathers the findings of every step', () => {
    expect(findingsOf(new Report()).map((finding) => finding.step)).toEqual([
      ...Array(7).fill('Report'),
      'Expenses',
    ])
  })
})
