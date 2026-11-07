import { Amount } from './amount.ts'
import type { CalendarDate } from './calendar-date.ts'
import type { Document } from './document.ts'
import type { Expense } from './expense.ts'
import { fieldNames, findingsOf } from './findings.ts'
import { Kind } from './kind.ts'
import type { Report } from './report.ts'

/** A field of the cover: its name and its value. */
export interface CoverField {
  readonly name: string
  readonly value: string
}

/** A kind of document on the cover: ticked when its section exists. */
export interface AttachedInformation {
  readonly kind: Kind
  readonly isAttached: boolean
}

/** A row of the cover's table of expenses. */
export interface ExpenseRow {
  readonly number: number
  readonly date: string
  readonly description: string
  readonly foreignAmount: string
  readonly claimedAmount: string
  /** The labels of the documents supporting the expense, in the order of the report document. */
  readonly supportingDocuments: readonly string[]
}

/** A document of a section: its label, and the expenses it supports. */
export interface LabelledDocument {
  readonly label: string
  readonly document: Document
  /** The numbers of the expenses the document supports. */
  readonly expenseNumbers: readonly number[]
  /** How its stamp names them: Expense for one, Expenses for several. */
  readonly expensesName: 'Expense' | 'Expenses'
}

/** The part of the report document holding the documents of one kind. */
export interface Section {
  readonly kind: Kind
  readonly title: string
  readonly documents: readonly LabelledDocument[]
}

/** What the report document holds, worked out from a report without findings. */
export interface Layout {
  readonly title: string
  readonly author: string
  readonly fileName: string
  readonly coverFields: readonly CoverField[]
  readonly attachedInformation: readonly AttachedInformation[]
  readonly expenses: readonly ExpenseRow[]
  readonly total: string
  readonly sections: readonly Section[]
}

/** A report without findings, with every required field there. */
interface Complete {
  readonly claimantName: string
  readonly position: string
  readonly email: string
  readonly purpose: string
  readonly account: string
}

/**
 * The layout of the report document of a report. Throws a TypeError when the report has
 * findings: only a report without findings has a report document.
 */
export function layoutOf(report: Report): Layout {
  const complete = completeReport(report)
  const expenses = [...report.expenses].sort(byDate)
  const sections = [Kind.receipt, Kind.bankStatement]
    .map((kind) => sectionOf(kind, expenses))
    .filter((section) => section.documents.length > 0)
  const labels = new Map(
    sections.flatMap((section) =>
      section.documents.map((entry) => [entry.document, entry.label] as const),
    ),
  )
  return {
    title: `McSCert Expense Report — ${complete.purpose}`,
    author: complete.claimantName,
    fileName: fileNameOf(complete, report.firstDay ?? expenses[0]?.date),
    coverFields: coverFieldsOf(report, complete),
    attachedInformation: Kind.all.map((kind) => attachedInformationOf(kind, sections)),
    expenses: expenses.map((expense, index) => rowOf(expense, index + 1, labels)),
    total: totalOf(expenses),
    sections,
  }
}

function completeReport(report: Report): Complete {
  const findings = findingsOf(report)
  const { claimantName, position, email, purpose, account } = report
  if (
    findings.length > 0 ||
    claimantName === undefined ||
    position === undefined ||
    email === undefined ||
    purpose === undefined ||
    account === undefined
  ) {
    throw new TypeError('Only a report without findings has a report document')
  }
  return { claimantName, position, email, purpose, account }
}

/** Expenses are sorted by date, then kept in the order they were added. */
function byDate(one: Expense, other: Expense): number {
  if (one.date === undefined || other.date === undefined) {
    return 0
  }
  return one.date.compareTo(other.date)
}

/**
 * expense-report-<date>-<claimant>.pdf: the first day of the report, or the date of its earliest
 * expense; the claimant in lower case, without accents, words joined by hyphens.
 */
function fileNameOf(complete: Complete, date: CalendarDate | undefined): string {
  const claimant = complete.claimantName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
  return `expense-report-${date?.toString() ?? ''}-${claimant}.pdf`
}

function coverFieldsOf(report: Report, complete: Complete): CoverField[] {
  const fields: CoverField[] = [
    { name: fieldNames.claimantName, value: complete.claimantName },
    { name: fieldNames.position, value: complete.position },
    { name: fieldNames.email, value: complete.email },
  ]
  if (report.asksForSupervisor) {
    fields.push({ name: fieldNames.supervisorName, value: report.supervisorName ?? '' })
    fields.push({ name: fieldNames.supervisorEmail, value: report.supervisorEmail ?? '' })
  }
  if (report.asksForHost) {
    fields.push({ name: fieldNames.hostName, value: report.hostName ?? '' })
    fields.push({ name: fieldNames.hostEmail, value: report.hostEmail ?? '' })
  }
  fields.push({ name: fieldNames.purpose, value: complete.purpose })
  const dates = datesOf(report.firstDay, report.lastDay)
  if (dates !== undefined) {
    fields.push({ name: 'Dates', value: dates })
  }
  fields.push({ name: fieldNames.account, value: complete.account })
  return fields
}

/** The dates of the report: both days, one day when they are the same or only one is given. */
function datesOf(
  firstDay: CalendarDate | undefined,
  lastDay: CalendarDate | undefined,
): string | undefined {
  if (firstDay !== undefined && lastDay !== undefined && !firstDay.equals(lastDay)) {
    return `${firstDay} to ${lastDay}`
  }
  return (firstDay ?? lastDay)?.toString()
}

/**
 * The section of a kind: its documents by the number of the first expense they support, then in
 * the order they were added, each in the report once whatever the number of expenses it supports.
 */
function sectionOf(kind: Kind, expenses: readonly Expense[]): Section {
  const supported = new Map<Document, number[]>()
  expenses.forEach((expense, index) => {
    const documents = kind === Kind.receipt ? expense.receipts : expense.bankStatements
    for (const document of documents) {
      supported.set(document, [...(supported.get(document) ?? []), index + 1])
    }
  })
  const documents = [...supported].map(([document, numbers], rank) => ({
    label: `${kind.letter}${rank + 1}`,
    document,
    expenseNumbers: numbers,
    expensesName: numbers.length === 1 ? ('Expense' as const) : ('Expenses' as const),
  }))
  return { kind, title: kind.plural, documents }
}

function attachedInformationOf(kind: Kind, sections: readonly Section[]): AttachedInformation {
  const isAttached = sections.some((section) => section.kind === kind)
  return { kind, isAttached }
}

function rowOf(expense: Expense, number: number, labels: Map<Document, string>): ExpenseRow {
  const supporting = [...expense.receipts, ...expense.bankStatements].map(
    (document) => labels.get(document) ?? '',
  )
  return {
    number,
    date: expense.date?.toString() ?? '',
    description: expense.description ?? '',
    foreignAmount: '',
    claimedAmount: expense.claimedAmount?.toString() ?? '',
    supportingDocuments: supporting,
  }
}

/** The total of the claimed amounts: a report without findings claims at least one. */
function totalOf(expenses: readonly Expense[]): string {
  const cents = expenses.reduce((sum, expense) => sum + (expense.claimedAmount?.cents ?? 0), 0)
  return new Amount(cents).toString()
}
