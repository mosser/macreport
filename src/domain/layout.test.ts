import { describe, expect, it } from 'vitest'
import { Amount } from './amount.ts'
import { CalendarDate } from './calendar-date.ts'
import { Document } from './document.ts'
import { Expense } from './expense.ts'
import { Kind } from './kind.ts'
import { layoutOf } from './layout.ts'
import { Report } from './report.ts'

const receipt = new Document(Kind.receipt, 'air-canada.pdf', new Uint8Array([1]))
const statement = new Document(Kind.bankStatement, 'statement-october.pdf', new Uint8Array([2]))

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
  account: '20-123-456',
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

  it("carries the template's fields on the cover, the supervisor of a student included", () => {
    expect(layoutOf(report).coverFields).toEqual([
      { name: 'Name of claimant', value: 'Zoë Lefèvre-Smith' },
      { name: 'Position', value: 'Student' },
      { name: 'Email', value: 'zoe@mcmaster.ca' },
      { name: 'Supervisor', value: 'Ada Lovelace' },
      { name: "Supervisor's email", value: 'ada@mcmaster.ca' },
      { name: 'Purpose', value: 'ICSE 2026' },
      { name: 'Dates', value: '2026-10-03 to 2026-10-07' },
      { name: 'Account', value: '20-123-456' },
    ])
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

  it('ticks the kinds the report holds', () => {
    expect(
      layoutOf(report).attachedInformation.map(({ kind, isAttached }) => [kind.name, isAttached]),
    ).toEqual([
      ['Receipt', true],
      ['Missing receipt authorization', false],
      ['Bank statement', true],
      ['Additional document', false],
    ])
  })

  it('numbers the expenses, labels their supporting documents and totals them', () => {
    const layout = layoutOf(report)
    expect(layout.expenses).toEqual([
      {
        number: 1,
        date: '2026-10-03',
        description: 'Air Canada, YYZ–CDG return',
        foreignAmount: '',
        claimedAmount: '$1,012.35',
        supportingDocuments: ['R1', 'S1'],
      },
    ])
    expect(layout.total).toBe('$1,012.35')
  })

  it('opens a section per kind held, receipts first, each document with the expenses it supports', () => {
    const sections = layoutOf(report).sections
    expect(sections.map((section) => section.title)).toEqual(['Receipts', 'Bank statements'])
    expect(sections[0]?.documents).toEqual([
      {
        label: 'R1',
        document: receipt,
        expenseNumbers: [1],
        expenses: [{ number: 1, name: 'Expense 1: Air Canada, YYZ–CDG return' }],
      },
    ])
    expect(sections[1]?.documents).toEqual([
      {
        label: 'S1',
        document: statement,
        expenseNumbers: [1],
        expenses: [{ number: 1, name: 'Expense 1: Air Canada, YYZ–CDG return' }],
      },
    ])
  })

  it('names an expense in a stamp by the first 30 characters of its description', () => {
    const dinner = report.afterReplacing(
      flight,
      flight.afterChanging({ description: 'Dinner with the programme committee of ICSE' }),
    )
    expect(layoutOf(dinner).sections[0]?.documents[0]?.expenses).toEqual([
      { number: 1, name: 'Expense 1: Dinner with the programme comm…' },
    ])
    const exactly = report.afterReplacing(
      flight,
      flight.afterChanging({ description: 'Ζ'.repeat(30) }),
    )
    expect(layoutOf(exactly).sections[0]?.documents[0]?.expenses[0]?.name).toBe(
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
      layout.expenses.map((row) => [row.number, row.description, row.supportingDocuments]),
    ).toEqual([
      [1, 'Taxi', ['R1', 'S1']],
      [2, 'Air Canada, YYZ–CDG return', ['R2', 'S1']],
    ])
    expect(layout.total).toBe('$1,099.45')
    expect(layout.sections[1]?.documents).toEqual([
      {
        label: 'S1',
        document: statement,
        expenseNumbers: [1, 2],
        expenses: [
          { number: 1, name: 'Expense 1: Taxi' },
          { number: 2, name: 'Expense 2: Air Canada, YYZ–CDG return' },
        ],
      },
    ])
  })
})
