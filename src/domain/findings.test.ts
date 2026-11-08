import { describe, expect, it } from 'vitest'
import { Amount } from './amount.ts'
import { CalendarDate } from './calendar-date.ts'
import { Currency } from './currency.ts'
import { Document } from './document.ts'
import { Expense } from './expense.ts'
import {
  alreadyInReportWording,
  claimedAmountInAnotherCurrencyRule,
  fieldRules,
  findingsOf,
  findingsOfAdditionalDocumentsStep,
  findingsOfExpensesStep,
  findingsOfReportStep,
  isRequired,
  lacksOf,
  missingFieldsOf,
  requiredWording,
} from './findings.ts'
import { Kind } from './kind.ts'
import { Meal } from './meal.ts'
import { PerDiem } from './per-diem.ts'
import { Report } from './report.ts'

const wordings = (findings: readonly { wording: string }[]) => findings.map((f) => f.wording)

const complete = new Report({
  claimantName: 'Zoë Lefèvre',
  position: 'Faculty',
  email: 'zoe@mcmaster.ca',
  purpose: 'ICSE 2026',
  isBusinessTravel: true,
  firstDay: new CalendarDate(2026, 10, 3),
  lastDay: new CalendarDate(2026, 10, 7),
  locations: 'Rio de Janeiro, Brazil',
  accountName: '20-123-456',
})

describe('findings of the Report step', () => {
  it('asks an account name, its code being optional', () => {
    expect(fieldRules.accountCode).toBeUndefined()
    expect(isRequired('accountCode')).toBe(false)
    expect(isRequired('accountName')).toBe(true)
  })

  it('names each required field missing; only a business travel has dates', () => {
    expect(wordings(findingsOfReportStep(new Report()))).toEqual([
      'Name of claimant is required.',
      'Position is required.',
      'Email is required.',
      'Purpose is required.',
      'Account name is required.',
    ])
    expect(findingsOfReportStep(complete.afterChanging({ isBusinessTravel: false }))).toEqual([])
    const undated = complete.afterChanging({
      firstDay: undefined,
      lastDay: undefined,
      locations: undefined,
    })
    expect(wordings(findingsOfReportStep(undated))).toEqual([
      'First day is required.',
      'Last day is required.',
      'Location(s) is required.',
    ])
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
    expect(
      wordings(findingsOfReportStep(backwards.afterChanging({ firstDay: undefined }))),
    ).toEqual(['First day is required.'])
    const oneDay = complete.afterChanging({ lastDay: new CalendarDate(2026, 10, 3) })
    expect(findingsOfReportStep(oneDay)).toEqual([])
  })
})

describe('findings of the Expenses step', () => {
  it('finds that no expense or per diem is claimed; a per diem with a meal claimed is enough', () => {
    expect(findingsOfExpensesStep(complete)).toEqual([
      { step: 'Expenses', wording: 'No expense or per diem is claimed.' },
    ])
    const day = new CalendarDate(2026, 10, 4)
    const nothing = complete.afterChangingPerDiem(
      new PerDiem(day, { internationalMeals: Meal.all }),
    )
    expect(wordings(findingsOfExpensesStep(nothing))).toEqual([
      'No expense or per diem is claimed.',
    ])
    const dinner = complete.afterChangingPerDiem(new PerDiem(day, { mealsClaimed: [Meal.dinner] }))
    expect(findingsOfExpensesStep(dinner)).toEqual([])
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

  it('asks an expense paid in another currency for its foreign amount and currency, not its claimed amount', () => {
    const paid = new Expense({
      date: new CalendarDate(2026, 10, 5),
      description: 'Taxi',
      isPaidInAnotherCurrency: true,
      receipts: [new Document(Kind.receipt, 'taxi.pdf', new Uint8Array())],
      bankStatements: [new Document(Kind.bankStatement, 'visa.pdf', new Uint8Array())],
    })
    expect(wordings(findingsOfExpensesStep(complete.afterAdding(paid)))).toEqual([
      'Expense 2026-10-05, Taxi: Foreign amount is required.',
      'Expense 2026-10-05, Taxi: Currency is required.',
    ])
    expect(missingFieldsOf(paid)).toEqual(['foreignAmount', 'currency'])
    const withForeignAmount = paid.afterChanging({
      foreignAmount: new Amount(5500),
      currency: Currency.parse('EUR'),
    })
    expect(findingsOfExpensesStep(complete.afterAdding(withForeignAmount))).toEqual([])
    expect(isRequired('claimedAmount', paid)).toBe(false)
    expect(isRequired('claimedAmount', new Expense())).toBe(true)
    expect(isRequired('paidInAnotherCurrency')).toBe(false)
  })

  it('says what an expense lacks: its missing fields, then its documents named as one before', () => {
    const visa = new Document(Kind.bankStatement, 'visa.pdf', new Uint8Array([1]))
    const taxi = new Document(Kind.receipt, 'taxi.pdf', new Uint8Array([2]), 'VISA')
    const flight = new Expense({ bankStatements: [visa] })
    const ride = new Expense({ description: 'Taxi', receipts: [taxi], bankStatements: [visa] })
    const report = complete.afterAdding(flight).afterAdding(ride)
    expect(lacksOf(report, ride)).toEqual([
      'Date is required.',
      'Claimed amount (CAD) is required.',
      "taxi.pdf: Name VISA is already another document's.",
    ])
    expect(lacksOf(report, flight)).not.toContain(
      "visa.pdf: Name visa is already another document's.",
    )
  })

  it('words the statuses and rules of an expense exactly', () => {
    expect(requiredWording('receipts')).toBe('Receipt is required.')
    const visa = new Document(Kind.bankStatement, 'scan.pdf', new Uint8Array(), 'Visa, October')
    expect(alreadyInReportWording(visa)).toBe('Already in the report, as Visa, October: chosen.')
    expect(fieldRules.currency).toBe('A three-letter ISO 4217 code, other than CAD.')
    expect(fieldRules.foreignAmount).toBe('More than zero, at most two decimals.')
    expect(claimedAmountInAnotherCurrencyRule).toBe(
      'In Canadian dollars, more than zero, at most two decimals; left empty, McSCert works it out.',
    )
  })

  it('gathers the findings of every step', () => {
    expect(findingsOf(new Report()).map((finding) => finding.step)).toEqual([
      ...Array(5).fill('Report'),
      'Expenses',
    ])
    expect(findingsOf(complete).map((finding) => finding.step)).toEqual([
      'Expenses',
      'Additional documents',
    ])
  })
})

describe('findings of the Additional documents step', () => {
  it('asks a business travel for a travel justification, and another report for none', () => {
    expect(findingsOfAdditionalDocumentsStep(complete)).toEqual([
      { step: 'Additional documents', wording: 'At least one travel justification is required.' },
    ])
    const invitation = new Document(Kind.additionalDocument, 'invitation.pdf', new Uint8Array())
    const justified = complete.afterChanging({ travelJustifications: [invitation] })
    expect(findingsOfAdditionalDocumentsStep(justified)).toEqual([])
    const elsewhere = complete.afterChanging({ isBusinessTravel: false })
    expect(findingsOfAdditionalDocumentsStep(elsewhere)).toEqual([])
  })

  it('finds a document named as one before it, at the step of the later one', () => {
    const receipt = new Document(Kind.receipt, 'scan.pdf', new Uint8Array([1]), 'Hotel')
    const statement = new Document(Kind.bankStatement, 'visa.pdf', new Uint8Array([2]), 'HOTEL')
    const poster = new Document(Kind.additionalDocument, 'poster.png', new Uint8Array([3]), 'hotel')
    const report = complete
      .afterChanging({ isBusinessTravel: false, additionalDocuments: [poster] })
      .afterAdding(
        new Expense({
          date: new CalendarDate(2026, 10, 5),
          description: 'Taxi',
          claimedAmount: new Amount(8710),
          receipts: [receipt],
          bankStatements: [statement],
        }),
      )
    expect(findingsOfExpensesStep(report)).toEqual([
      { step: 'Expenses', wording: "visa.pdf: Name HOTEL is already another document's." },
    ])
    expect(findingsOfAdditionalDocumentsStep(report)).toEqual([
      {
        step: 'Additional documents',
        wording: "poster.png: Name hotel is already another document's.",
      },
    ])
  })

  it('requires a travel justification, but neither an additional document nor a name', () => {
    expect(isRequired('travelJustifications')).toBe(true)
    expect(isRequired('additionalDocuments')).toBe(false)
    expect(isRequired('documentName')).toBe(false)
  })
})
