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
  findingsOfCharacters,
  findingsOfExpensesStep,
  findingsOfReportStep,
  isRequired,
  lacksOf,
  missingFieldsOf,
  missingReceiptNotice,
  RefusedFile,
  refusalWording,
  refusedAsAlreadyInReportWording,
  requiredWording,
} from './findings.ts'
import { Kind } from './kind.ts'
import { Meal } from './meal.ts'
import { MissingReceipt } from './missing-receipt.ts'
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
      'Email is required, as an email address.',
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
        "Supervisor's email is required, as an email address.",
      ])
    }
  })

  it("asks a visitor for their host's name and email", () => {
    const visitor = complete.afterChanging({ position: 'Visitor' })
    expect(wordings(findingsOfReportStep(visitor))).toEqual([
      'Host is required.',
      "Host's email is required, as an email address.",
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

describe('findings of the characters the report document cannot write', () => {
  const wordingsOf = (report: Report) => wordings(findingsOfCharacters(report))

  it('finds none in what the font holds', () => {
    expect(findingsOfCharacters(complete)).toEqual([])
  })

  it('names a field of the report, and the character by itself and its code', () => {
    expect(wordingsOf(complete.afterChanging({ purpose: 'ICSE 日' }))).toEqual([
      'Purpose holds a character the report document cannot write: 日 (U+65E5).',
    ])
  })

  it('names every character of a text once, in one finding', () => {
    expect(wordingsOf(complete.afterChanging({ locations: '東京 東京 😀' }))).toEqual([
      'Location(s) holds characters the report document cannot write: 東 (U+6771), 京 (U+4EAC), 😀 (U+1F600).',
    ])
  })

  it('checks every field the report document writes', () => {
    const texts = {
      claimantName: '日',
      email: '日@mcmaster.ca',
      purpose: '日',
      accountName: '日',
      accountCode: '日',
    }
    expect(wordingsOf(complete.afterChanging(texts))).toHaveLength(5)
    const student = complete.afterChanging({
      position: 'Student',
      supervisorName: '日',
      supervisorEmail: '日@mcmaster.ca',
    })
    expect(wordingsOf(student)).toHaveLength(2)
    const visitor = complete.afterChanging({
      position: 'Visitor',
      hostName: '日',
      hostEmail: '日@mcmaster.ca',
    })
    expect(wordingsOf(visitor)).toHaveLength(2)
  })

  it('names an expense by its date and its description', () => {
    const expense = new Expense({ date: new CalendarDate(2026, 10, 3), description: 'Dinner 😀' })
    expect(wordingsOf(complete.afterAdding(expense))).toEqual([
      'Expense 2026-10-03, Dinner 😀: Description holds a character the report document cannot write: 😀 (U+1F600).',
    ])
  })

  it('names the meal of a per diem, for a day with a meal claimed only', () => {
    const day = new CalendarDate(2026, 10, 4)
    const reasons = new Map([[Meal.lunch, '日']])
    expect(
      wordingsOf(
        complete.afterChangingPerDiem(new PerDiem(day, { mealsClaimed: [Meal.dinner], reasons })),
      ),
    ).toEqual([
      'Per diem 2026-10-04, lunch: Reason holds a character the report document cannot write: 日 (U+65E5).',
    ])
    expect(wordingsOf(complete.afterChangingPerDiem(new PerDiem(day, { reasons })))).toEqual([])
  })

  it('names a document by its kind and its file name, and looks at its name, not at its file name', () => {
    const receipt = new Document(Kind.receipt, '領収書.pdf', new Uint8Array())
    const expense = new Expense({ receipts: [receipt] })
    expect(wordingsOf(complete.afterAdding(expense))).toEqual([
      'Receipt 領収書.pdf: Name holds characters the report document cannot write: 領 (U+9818), 収 (U+53CE), 書 (U+66F8).',
    ])
    const renamed = complete.afterAdding(
      new Expense({ receipts: [receipt.afterNaming('Receipt')] }),
    )
    expect(wordingsOf(renamed)).toEqual([])
    const invitation = new Document(Kind.additionalDocument, '招待.pdf', new Uint8Array())
    const [finding] = findingsOfCharacters(
      complete.afterChanging({ travelJustifications: [invitation] }),
    )
    expect(finding?.step).toBe('Additional documents')
    expect(finding?.wording).toContain('Additional document 招待.pdf: Name holds')
  })

  it('stands between the report and its report document, and holds no step', () => {
    const report = complete.afterChanging({ purpose: '日' })
    expect(wordings(findingsOf(report))).toContain(
      'Purpose holds a character the report document cannot write: 日 (U+65E5).',
    )
    expect(findingsOfReportStep(report)).toEqual([])
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

  it('requires no bank statement of an expense paid in cash, and it again once that is taken back', () => {
    const paid = new Expense({
      date: new CalendarDate(2026, 10, 5),
      description: 'Taxi',
      claimedAmount: new Amount(5500),
      receipts: [new Document(Kind.receipt, 'taxi.pdf', new Uint8Array([9]))],
      isPaidInCash: true,
    })
    expect(missingFieldsOf(paid)).toEqual([])
    expect(missingFieldsOf(paid.afterChanging({ isPaidInCash: false }))).toEqual(['bankStatements'])
    expect(isRequired('paidInCash')).toBe(false)
  })

  it('requires no receipt of an expense with a missing receipt, and it again once that is taken back', () => {
    const missing = new MissingReceipt({ reason: 'Lost', paidTo: 'Taxi', jobTitle: 'PhD Student' })
    const stated = new Expense({
      date: new CalendarDate(2026, 10, 5),
      description: 'Taxi',
      claimedAmount: new Amount(5500),
      missingReceipt: missing,
      isPaidInCash: true,
    })
    expect(missingFieldsOf(stated)).toEqual([])
    expect(missingFieldsOf(stated.afterChanging({ missingReceipt: undefined }))).toEqual([
      'receipts',
    ])
  })

  it('finds a character the report document cannot write in what a missing receipt states', () => {
    const stated = complete.afterAdding(
      new Expense({
        date: new CalendarDate(2026, 10, 5),
        description: 'Taxi',
        missingReceipt: new MissingReceipt({
          reason: '失',
          paidTo: '東',
          jobTitle: '教',
          phoneExtension: '分',
        }),
      }),
    )
    expect(wordings(findingsOfCharacters(stated))).toEqual([
      'Expense 2026-10-05, Taxi: Reason for missing original receipt holds a character the report document cannot write: 失 (U+5931).',
      'Expense 2026-10-05, Taxi: Paid to holds a character the report document cannot write: 東 (U+6771).',
      'Expense 2026-10-05, Taxi: Your job title holds a character the report document cannot write: 教 (U+6559).',
      'Expense 2026-10-05, Taxi: Phone extension holds a character the report document cannot write: 分 (U+5206).',
    ])
  })

  it('requires what a missing receipt states but its phone extension, and gives examples of a job title', () => {
    expect(isRequired('reasonForMissingReceipt')).toBe(true)
    expect(isRequired('paidTo')).toBe(true)
    expect(isRequired('jobTitle')).toBe(true)
    expect(isRequired('phoneExtension')).toBe(false)
    expect(fieldRules.jobTitle).toBe('E.g., Associate Prof, Research Engineer, PhD Student.')
  })

  it('says why a file is refused', () => {
    expect(refusalWording('a.txt', 'format')).toBe(
      'a.txt is refused: it is not a PDF, a JPEG image or a PNG image.',
    )
    expect(refusalWording('a.pdf', 'damaged')).toBe('a.pdf is refused: it is damaged.')
    expect(refusalWording('a.pdf', 'without pages')).toBe(
      'a.pdf is refused: it is a PDF without pages.',
    )
    expect(refusalWording('a.pdf', 'password')).toBe(
      'a.pdf is refused: it is protected by a password.',
    )
    expect(
      refusedAsAlreadyInReportWording(
        'visa.pdf',
        new Document(Kind.bankStatement, 'october.pdf', new Uint8Array([1]), 'Visa, October'),
      ),
    ).toBe('visa.pdf is refused: it is already in the report, as Bank statement Visa, October.')
    const refused = new RefusedFile('a.pdf', 'damaged')
    expect(refused.message).toBe('a.pdf is refused: it is damaged.')
    expect(refused.name).toBe('RefusedFile')
  })

  it('tells the Claimant what follows from a missing receipt', () => {
    expect(missingReceiptNotice).toEqual({
      text: "McMaster's official Missing Receipt Authorization Form will be written on your behalf. You will have to sign it in the final PDF.",
      stressed: 'Accounts Payable may not accept it, and may return the report.',
    })
  })

  it('requires a travel justification, but neither an additional document nor a name', () => {
    expect(isRequired('travelJustifications')).toBe(true)
    expect(isRequired('additionalDocuments')).toBe(false)
    expect(isRequired('documentName')).toBe(false)
  })
})
