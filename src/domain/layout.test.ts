import { describe, expect, it } from 'vitest'
import { Amount } from './amount.ts'
import { CalendarDate } from './calendar-date.ts'
import { Currency } from './currency.ts'
import { Document } from './document.ts'
import { Expense } from './expense.ts'
import { Kind } from './kind.ts'
import { layoutOf, mealsNotClaimedOf, perDiemDescriptionsOf, totalOf } from './layout.ts'
import { Meal } from './meal.ts'
import { PerDiem } from './per-diem.ts'
import { Report } from './report.ts'

const receipt = new Document(Kind.receipt, 'air-canada.pdf', new Uint8Array([1]))
const statement = new Document(Kind.bankStatement, 'statement-october.pdf', new Uint8Array([2]))
const invitation = new Document(Kind.additionalDocument, 'invitation.pdf', new Uint8Array([4]))

const flight = new Expense({
  date: new CalendarDate(2026, 10, 3),
  description: 'Air Canada, YYZ–CDG return',
  claimedAmount: new Amount(101235),
  receipts: [receipt],
  bankStatements: [statement],
})

const report = new Report({
  claimantName: 'Zoë Lefèvre-Smith',
  position: 'Student',
  email: 'zoe@mcmaster.ca',
  supervisorName: 'Ada Lovelace',
  supervisorEmail: 'ada@mcmaster.ca',
  purpose: 'ICSE 2026',
  isBusinessTravel: true,
  firstDay: new CalendarDate(2026, 10, 3),
  lastDay: new CalendarDate(2026, 10, 7),
  locations: 'Rio de Janeiro, Brazil',
  accountName: '20-123-456',
  travelJustifications: [invitation],
}).afterAdding(flight)

describe('layoutOf', () => {
  it('is only for a report without findings', () => {
    expect(() => layoutOf(new Report())).toThrow(TypeError)
  })

  it('names the report document and its properties', () => {
    const layout = layoutOf(report)
    expect(layout.title).toBe('McSCert Expense Report — ICSE 2026')
    expect(layout.author).toBe('Zoë Lefèvre-Smith')
    expect(layout.fileName).toBe('expense-report-2026-10-03-zoe-lefevre-smith.pdf')
  })

  it("carries the template's fields on the cover, the purpose first, the supervisor of a student included", () => {
    expect(layoutOf(report).coverFields).toEqual([
      { name: 'Purpose', value: 'ICSE 2026' },
      { name: 'Dates', value: '2026-10-03 to 2026-10-07' },
      { name: 'Location(s)', value: 'Rio de Janeiro, Brazil' },
      { name: 'Name of claimant', value: 'Zoë Lefèvre-Smith' },
      { name: 'Position', value: 'Student' },
      { name: 'Email', value: 'zoe@mcmaster.ca' },
      { name: 'Supervisor', value: 'Ada Lovelace' },
      { name: "Supervisor's email", value: 'ada@mcmaster.ca' },
      { name: 'Account', value: '20-123-456' },
    ])
  })

  it('writes the account by its name, then its code in parentheses when it is given', () => {
    const coded = report.afterChanging({
      accountName: 'NSERC Discovery',
      accountCode: '20-123-456',
    })
    expect(layoutOf(coded).coverFields.at(-1)).toEqual({
      name: 'Account',
      value: 'NSERC Discovery (20-123-456)',
    })
  })

  it('names the supervisor of a postdoctoral fellow, and no one for faculty', () => {
    const postdoc = layoutOf(report.afterChanging({ position: 'Postdoctoral fellow' })).coverFields
    expect(postdoc).toContainEqual({ name: 'Supervisor', value: 'Ada Lovelace' })
    expect(postdoc).toContainEqual({ name: "Supervisor's email", value: 'ada@mcmaster.ca' })
    const faculty = layoutOf(report.afterChanging({ position: 'Faculty' })).coverFields
    expect(faculty.map((field) => field.name)).not.toContain('Supervisor')
    expect(faculty.map((field) => field.name)).not.toContain('Host')
  })

  it('dates a business travel, and names its file after its first day', () => {
    const travel = layoutOf(report.afterChanging({ firstDay: new CalendarDate(2026, 10, 1) }))
    expect(travel.coverFields).toContainEqual({ name: 'Dates', value: '2026-10-01 to 2026-10-07' })
    expect(travel.fileName).toBe('expense-report-2026-10-01-zoe-lefevre-smith.pdf')
  })

  it('gives no dates to another report, and names its file after its earliest expense', () => {
    const elsewhere = report.afterChanging({ firstDay: new CalendarDate(2026, 10, 1) })
    const layout = layoutOf(elsewhere.afterChanging({ isBusinessTravel: false }))
    expect(layout.coverFields.map((field) => field.name)).not.toContain('Dates')
    expect(layout.fileName).toBe('expense-report-2026-10-03-zoe-lefevre-smith.pdf')
  })

  it('names the host of a visitor, and gives one day for a purpose of one day', () => {
    const visitor = report.afterChanging({
      position: 'Visitor',
      hostName: 'Bo',
      hostEmail: 'bo@mcmaster.ca',
      lastDay: new CalendarDate(2026, 10, 3),
    })
    const fields = layoutOf(visitor).coverFields
    expect(fields).toContainEqual({ name: 'Host', value: 'Bo' })
    expect(fields).toContainEqual({ name: "Host's email", value: 'bo@mcmaster.ca' })
    expect(fields).toContainEqual({ name: 'Dates', value: '2026-10-03' })
  })

  it('ticks the kinds the report holds, in alphabetical order', () => {
    expect(
      layoutOf(report).attachedInformation.map(({ kind, isAttached }) => [kind.plural, isAttached]),
    ).toEqual([
      ['Additional documents', true],
      ['Bank statements', true],
      ['Missing receipt authorizations', false],
      ['Receipts', true],
    ])
  })

  it('numbers the expenses, names their supporting documents and totals them', () => {
    const layout = layoutOf(report)
    expect(layout.expenses).toEqual([
      {
        number: 1,
        date: '2026-10-03',
        description: 'Air Canada, YYZ–CDG return',
        foreignAmount: '',
        claimedAmount: '$1,012.35',
        supportingDocuments: [
          { label: 'R1', name: 'air-canada', document: receipt },
          { label: 'S1', name: 'statement-october', document: statement },
        ],
        mealsNotClaimed: '',
      },
    ])
    expect(layout.total).toEqual(['$1,012.35'])
  })

  it('itemizes each per diem with a meal claimed among the expenses, by date, after the expenses of its day', () => {
    const october = (day: number) => new CalendarDate(2026, 10, day)
    const taxi = flight.afterChanging({ date: october(5), description: 'Taxi' })
    const international = new PerDiem(october(5), {
      internationalMeals: Meal.all,
      mealsClaimed: [Meal.dinner, Meal.breakfast],
      reasons: new Map([[Meal.lunch, 'provided by the conference']]),
    })
    const domestic = new PerDiem(october(4), { mealsClaimed: Meal.all })
    const layout = layoutOf(
      report
        .afterAdding(taxi)
        .afterChangingPerDiem(international)
        .afterChangingPerDiem(domestic)
        .afterChangingPerDiem(new PerDiem(october(6), { internationalMeals: Meal.all })),
    )
    expect(
      layout.expenses.map((row) => [
        row.number,
        row.date,
        row.description,
        row.foreignAmount,
        row.claimedAmount,
        row.mealsNotClaimed,
      ]),
    ).toEqual([
      [1, '2026-10-03', 'Air Canada, YYZ–CDG return', '', '$1,012.35', ''],
      [2, '2026-10-04', 'Per diem, domestic: breakfast, lunch, dinner', '', '$113.50', ''],
      [3, '2026-10-05', 'Taxi', '', '$1,012.35', ''],
      [
        4,
        '2026-10-05',
        'Per diem, international: breakfast, dinner',
        'USD 86.10',
        '',
        'Not claimed: lunch (provided by the conference)',
      ],
    ])
    expect(layout.expenses[1]?.perDiem).toBe(domestic)
    expect(layout.expenses[1]?.supportingDocuments).toEqual([])
    expect(layout.total).toEqual(['$2,138.20', 'USD 86.10'])
    const receipts = layout.sections.find((section) => section.kind === Kind.receipt)
    expect(receipts?.documents[0]?.expenseNumbers).toEqual([1, 3])
    expect(receipts?.documents[0]?.expenses[1]?.name).toBe('Expense 3: Taxi')
  })

  it('itemizes a day of domestic and international meals on two rows, its meals not claimed under the last', () => {
    const day = new CalendarDate(2026, 10, 4)
    const mixed = new PerDiem(day, {
      mealsClaimed: [Meal.breakfast, Meal.dinner],
      internationalMeals: [Meal.dinner],
      reasons: new Map([[Meal.lunch, 'provided by the conference']]),
    })
    const layout = layoutOf(report.afterChangingPerDiem(mixed))
    expect(
      layout.expenses.map((row) => [
        row.number,
        row.description,
        row.foreignAmount,
        row.claimedAmount,
        row.mealsNotClaimed,
        row.perDiem === mixed,
      ]),
    ).toEqual([
      [1, 'Air Canada, YYZ–CDG return', '', '$1,012.35', '', false],
      [2, 'Per diem, domestic: breakfast', '', '$28.40', '', true],
      [
        3,
        'Per diem, international: dinner',
        'USD 57.70',
        '',
        'Not claimed: lunch (provided by the conference)',
        true,
      ],
    ])
    expect(layout.total).toEqual(['$1,040.75', 'USD 57.70'])
    expect(perDiemDescriptionsOf(mixed)).toEqual([
      'Per diem, domestic: breakfast',
      'Per diem, international: dinner',
    ])
  })

  it('names the meals of a per diem not claimed, with their reasons when given', () => {
    const day = new CalendarDate(2026, 10, 4)
    expect(mealsNotClaimedOf(new PerDiem(day))).toBe('Not claimed: breakfast, lunch, dinner')
    const lunch = new PerDiem(day, {
      mealsClaimed: [Meal.lunch],
      reasons: new Map([[Meal.dinner, 'invited by the host']]),
    })
    expect(mealsNotClaimedOf(lunch)).toBe('Not claimed: breakfast, dinner (invited by the host)')
  })

  it('totals the international per diems in US dollars, with the expenses paid in US dollars', () => {
    const day = new CalendarDate(2026, 10, 4)
    const paid = flight.afterChanging({
      isPaidInAnotherCurrency: true,
      foreignAmount: new Amount(1000),
      currency: Currency.usDollar,
      claimedAmount: undefined,
    })
    const dinner = new PerDiem(day, { internationalMeals: Meal.all, mealsClaimed: [Meal.dinner] })
    expect(totalOf([paid], [dinner])).toEqual(['USD 67.70'])
    expect(totalOf([], [new PerDiem(day)])).toEqual([])
  })

  it('totals the claimed amounts, then, by currency, the foreign amounts of the expenses without one', () => {
    const euro = Currency.parse('EUR')
    const yen = Currency.parse('JPY')
    const paid = (cents: number, currency: Currency | undefined, claimed?: Amount) =>
      flight.afterChanging({
        isPaidInAnotherCurrency: true,
        foreignAmount: new Amount(cents),
        currency,
        claimedAmount: claimed,
      })
    const layout = layoutOf(
      report
        .afterAdding(paid(5500, euro))
        .afterAdding(paid(300000, yen))
        .afterAdding(paid(1000, euro))
        .afterAdding(paid(64000, euro, new Amount(8710))),
    )
    expect(layout.expenses.map((row) => [row.foreignAmount, row.claimedAmount])).toEqual([
      ['', '$1,012.35'],
      ['EUR 55.00', ''],
      ['JPY 3,000.00', ''],
      ['EUR 10.00', ''],
      ['EUR 640.00', '$87.10'],
    ])
    expect(layout.total).toEqual(['$1,099.45', 'EUR 65.00', 'JPY 3,000.00'])
    const foreignOnly = report.afterReplacing(flight, paid(5500, euro))
    expect(layoutOf(foreignOnly).total).toEqual(['EUR 55.00'])
  })

  it('names a document as the Claimant named it, on the cover', () => {
    const named = report.afterRenaming(statement, 'Visa, October')
    expect(
      layoutOf(named).expenses[0]?.supportingDocuments.map(({ label, name }) => [label, name]),
    ).toEqual([
      ['R1', 'air-canada'],
      ['S1', 'Visa, October'],
    ])
  })

  it('opens a section per kind held, additional documents first, bank statements last, each document with the expenses it supports', () => {
    const sections = layoutOf(report).sections
    expect(sections.map((section) => section.title)).toEqual([
      'Additional documents',
      'Receipts',
      'Bank statements',
    ])
    expect(sections.map((section) => section.listsExpenses)).toEqual([false, true, true])
    expect(sections[0]?.documents).toEqual([
      {
        label: 'A1',
        document: invitation,
        expenseNumbers: [],
        expenses: [],
        stampedName: 'invitation',
      },
    ])
    expect(sections[1]?.documents).toEqual([
      {
        label: 'R1',
        document: receipt,
        expenseNumbers: [1],
        expenses: [
          {
            number: 1,
            description: 'Air Canada, YYZ–CDG return',
            name: 'Expense 1: Air Canada, YYZ–CDG return',
          },
        ],
      },
    ])
    expect(sections[2]?.documents).toEqual([
      {
        label: 'S1',
        document: statement,
        expenseNumbers: [1],
        expenses: [
          {
            number: 1,
            description: 'Air Canada, YYZ–CDG return',
            name: 'Expense 1: Air Canada, YYZ–CDG return',
          },
        ],
      },
    ])
  })

  it('names an expense in a stamp by the first 30 characters of its description', () => {
    const dinner = report.afterReplacing(
      flight,
      flight.afterChanging({ description: 'Dinner with the programme committee of ICSE' }),
    )
    expect(layoutOf(dinner).sections[1]?.documents[0]?.expenses).toEqual([
      {
        number: 1,
        description: 'Dinner with the programme comm…',
        name: 'Expense 1: Dinner with the programme comm…',
      },
    ])
    const exactly = report.afterReplacing(
      flight,
      flight.afterChanging({ description: 'Ζ'.repeat(30) }),
    )
    expect(layoutOf(exactly).sections[1]?.documents[0]?.expenses[0]?.name).toBe(
      `Expense 1: ${'Ζ'.repeat(30)}`,
    )
  })

  it('sorts expenses by date and lists a shared document once, with every expense it supports', () => {
    const taxiReceipt = new Document(Kind.receipt, 'taxi.png', new Uint8Array([3]))
    const taxi = new Expense({
      date: new CalendarDate(2026, 10, 1),
      description: 'Taxi',
      claimedAmount: new Amount(8710),
      receipts: [taxiReceipt],
      bankStatements: [statement],
    })
    const layout = layoutOf(report.afterAdding(taxi))
    expect(
      layout.expenses.map((row) => [
        row.number,
        row.description,
        row.supportingDocuments.map((document) => document.label),
      ]),
    ).toEqual([
      [1, 'Taxi', ['R1', 'S1']],
      [2, 'Air Canada, YYZ–CDG return', ['R2', 'S1']],
    ])
    expect(layout.total).toEqual(['$1,099.45'])
    expect(layout.sections[2]?.documents).toEqual([
      {
        label: 'S1',
        document: statement,
        expenseNumbers: [1, 2],
        expenses: [
          { number: 1, description: 'Taxi', name: 'Expense 1: Taxi' },
          {
            number: 2,
            description: 'Air Canada, YYZ–CDG return',
            name: 'Expense 2: Air Canada, YYZ–CDG return',
          },
        ],
      },
    ])
  })

  it('lists the travel justifications first among the additional documents, each in the order they were added', () => {
    const itinerary = new Document(Kind.additionalDocument, 'itinerary.pdf', new Uint8Array([5]))
    const poster = new Document(Kind.additionalDocument, 'poster.png', new Uint8Array([6]))
    const layout = layoutOf(report.afterChanging({ additionalDocuments: [itinerary, poster] }))
    const first = layout.sections[0]
    expect(first?.title).toBe('Additional documents')
    expect(first?.listsExpenses).toBe(false)
    expect(first?.documents.map((entry) => [entry.label, entry.document])).toEqual([
      ['A1', invitation],
      ['A2', itinerary],
      ['A3', poster],
    ])
    expect(layout.sections.at(-1)?.title).toBe('Bank statements')
  })

  it('names an expense on one line in a stamp, its line breaks as spaces, and keeps them on the cover', () => {
    const meal = report.afterReplacing(
      flight,
      flight.afterChanging({ description: 'Dinner with\n  Ada\nAlan' }),
    )
    const layout = layoutOf(meal)
    expect(layout.expenses[0]?.description).toBe('Dinner with\n  Ada\nAlan')
    expect(layout.sections[1]?.documents[0]?.expenses[0]?.description).toBe('Dinner with Ada Alan')
  })

  it('stamps an additional document with its name, its first 30 characters', () => {
    const programme = invitation.afterNaming('Programme of the 48th International Conference')
    const first = layoutOf(report.afterRenaming(invitation, programme.name)).sections[0]
    expect(first?.documents[0]?.stampedName).toBe('Programme of the 48th Internat…')
    expect(layoutOf(report).sections[1]?.documents[0]?.stampedName).toBeUndefined()
  })

  it('splits the additional documents of a business travel in two subsections, and of another report in none', () => {
    const itinerary = new Document(Kind.additionalDocument, 'itinerary.pdf', new Uint8Array([5]))
    const travel = layoutOf(report.afterChanging({ additionalDocuments: [itinerary] })).sections[0]
    expect(
      travel?.subsections.map(({ title, documents }) => [
        title,
        documents.map((entry) => entry.label),
      ]),
    ).toEqual([
      ['Travel justifications', ['A1']],
      ['Other documents', ['A2']],
    ])
    const justified = layoutOf(report).sections[0]
    expect(justified?.subsections.map((subsection) => subsection.title)).toEqual([
      'Travel justifications',
    ])
    const elsewhere = report.afterChanging({
      isBusinessTravel: false,
      additionalDocuments: [itinerary],
    })
    const section = layoutOf(elsewhere).sections[0]
    expect(section?.documents.map((entry) => entry.document)).toEqual([itinerary])
    expect(section?.subsections).toEqual([])
    expect(layoutOf(report).sections[1]?.subsections).toEqual([])
  })
})
