import type { Amount } from './amount.ts'
import type { CalendarDate } from './calendar-date.ts'
import type { Currency } from './currency.ts'
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

/** A document supporting an expense on the cover: named, and a link to it by its label. */
export interface SupportingDocument {
  readonly label: string
  readonly name: string
  readonly document: Document
}

/** A row of the cover's table of expenses. */
export interface ExpenseRow {
  readonly number: number
  readonly date: string
  readonly description: string
  readonly foreignAmount: string
  readonly claimedAmount: string
  /** The documents supporting the expense, one per line, in the order of the report document. */
  readonly supportingDocuments: readonly SupportingDocument[]
}

/**
 * An expense as a document names it, on its section page and in its stamp: its number, and the
 * start of its description.
 */
export interface StampedExpense {
  readonly number: number
  /** Air Canada, YYZ–CDG return; a description over 30 characters cut, with an ellipsis. */
  readonly description: string
  /** Expense 1: and its description, as a stamp names it. */
  readonly name: string
}

/** The number of characters of a description a stamp keeps. */
const stampedDescriptionLength = 30

/** A document of a section: its label, and the expenses it supports. */
export interface LabelledDocument {
  readonly label: string
  readonly document: Document
  /** The numbers of the expenses the document supports. */
  readonly expenseNumbers: readonly number[]
  /** The expenses it supports, as its stamp names them. */
  readonly expenses: readonly StampedExpense[]
  /**
   * The name of an additional document, as its stamp names it: over 30 characters cut, with an
   * ellipsis. A document that supports expenses is stamped with them instead.
   */
  readonly stampedName?: string
}

/** A part of a section page, its documents under a subheading of their own. */
export interface Subsection {
  readonly title: string
  readonly documents: readonly LabelledDocument[]
}

/** The part of the report document holding the documents of one kind. */
export interface Section {
  readonly kind: Kind
  readonly title: string
  /** Whether its section page lists the expenses each document supports. */
  readonly listsExpenses: boolean
  /** Its documents, in order. */
  readonly documents: readonly LabelledDocument[]
  /** How its section page splits its documents under subheadings; none when it does not. */
  readonly subsections: readonly Subsection[]
}

/** The subheadings of the section of additional documents of a business travel. */
const subheadings = { travelJustifications: 'Travel justifications', others: 'Other documents' }

/** What the report document holds, worked out from a report without findings. */
export interface Layout {
  readonly title: string
  readonly author: string
  readonly fileName: string
  readonly coverFields: readonly CoverField[]
  /** Every kind of document, in alphabetical order. */
  readonly attachedInformation: readonly AttachedInformation[]
  readonly expenses: readonly ExpenseRow[]
  /**
   * The total, one amount per line: the sum of the claimed amounts, when there is one, then, by
   * currency in alphabetical order, the sum of the foreign amounts of the expenses without one.
   */
  readonly total: readonly string[]
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
  const sections = [
    sectionOfAdditionalDocuments(report),
    sectionOf(Kind.receipt, expenses),
    sectionOf(Kind.bankStatement, expenses),
  ].filter((section) => section.documents.length > 0)
  const labels = new Map(
    sections.flatMap((section) =>
      section.documents.map((entry) => [entry.document, entry.label] as const),
    ),
  )
  return {
    title: `McSCert Expense Report — ${complete.purpose}`,
    author: complete.claimantName,
    fileName: fileNameOf(complete, report.isBusinessTravel ? report.firstDay : expenses[0]?.date),
    coverFields: coverFieldsOf(report, complete),
    attachedInformation: [...Kind.all]
      .sort((one, other) => one.plural.localeCompare(other.plural, 'en'))
      .map((kind) => attachedInformationOf(kind, sections)),
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
 * expense-report-<date>-<claimant>.pdf: the first day of a business travel, or the date of the
 * earliest expense of another report; the claimant in lower case, without accents, words joined
 * by hyphens.
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
    fields.push(
      { name: fieldNames.supervisorName, value: report.supervisorName ?? '' },
      { name: fieldNames.supervisorEmail, value: report.supervisorEmail ?? '' },
    )
  }
  if (report.asksForHost) {
    fields.push(
      { name: fieldNames.hostName, value: report.hostName ?? '' },
      { name: fieldNames.hostEmail, value: report.hostEmail ?? '' },
    )
  }
  fields.push({ name: fieldNames.purpose, value: complete.purpose })
  const dates = report.isBusinessTravel ? datesOf(report.firstDay, report.lastDay) : undefined
  if (dates !== undefined) {
    fields.push({ name: 'Dates', value: dates })
  }
  fields.push({ name: fieldNames.account, value: complete.account })
  return fields
}

/** The dates of a business travel: both days, or one day when they are the same. */
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
  const supported = new Map<Document, StampedExpense[]>()
  expenses.forEach((expense, index) => {
    const documents = kind === Kind.receipt ? expense.receipts : expense.bankStatements
    const stamped = stampedExpenseOf(expense, index + 1)
    for (const document of documents) {
      supported.set(document, [...(supported.get(document) ?? []), stamped])
    }
  })
  const documents = [...supported].map(([document, stamped], rank) => ({
    label: `${kind.letter}${rank + 1}`,
    document,
    expenseNumbers: stamped.map((expense) => expense.number),
    expenses: stamped,
  }))
  return { kind, title: kind.plural, listsExpenses: true, documents, subsections: [] }
}

/**
 * The section of the documents of the report as a whole: the travel justifications, then the
 * other additional documents, each in the order they were added. Of a business travel, its
 * section page lists them in two subsections, Travel justifications then Other documents,
 * a subsection without documents left out.
 */
function sectionOfAdditionalDocuments(report: Report): Section {
  const kind = Kind.additionalDocument
  const documents = [...report.travelJustifications, ...report.additionalDocuments].map(
    (document, rank) => ({
      label: `${kind.letter}${rank + 1}`,
      document,
      expenseNumbers: [],
      expenses: [],
      stampedName: cut(document.name),
    }),
  )
  const count = report.travelJustifications.length
  const subsections = report.isBusinessTravel
    ? [
        { title: subheadings.travelJustifications, documents: documents.slice(0, count) },
        { title: subheadings.others, documents: documents.slice(count) },
      ].filter((subsection) => subsection.documents.length > 0)
    : []
  return { kind, title: kind.plural, listsExpenses: false, documents, subsections }
}

/** Expense 1: and the first 30 characters of its description, an ellipsis when it is longer. */
function stampedExpenseOf(expense: Expense, number: number): StampedExpense {
  const description = cut(expense.description ?? '')
  return { number, description, name: `Expense ${number}: ${description}` }
}

/**
 * A text as a stamp keeps it, on one line: its line breaks as spaces, then its first 30
 * characters, an ellipsis when it is longer.
 */
function cut(text: string): string {
  const oneLine = text
    .split('\n')
    .map((line) => line.trim())
    .join(' ')
  const characters = [...oneLine]
  return characters.length > stampedDescriptionLength
    ? `${characters.slice(0, stampedDescriptionLength).join('').trimEnd()}…`
    : characters.join('')
}

function attachedInformationOf(kind: Kind, sections: readonly Section[]): AttachedInformation {
  const isAttached = sections.some((section) => section.kind === kind)
  return { kind, isAttached }
}

function rowOf(expense: Expense, number: number, labels: Map<Document, string>): ExpenseRow {
  const supporting = [...expense.receipts, ...expense.bankStatements].map((document) => ({
    label: labels.get(document) ?? '',
    name: document.name,
    document,
  }))
  return {
    number,
    date: expense.date?.toString() ?? '',
    description: expense.description ?? '',
    foreignAmount: expense.foreignAmountText,
    claimedAmount: expense.claimedAmount?.toString() ?? '',
    supportingDocuments: supporting,
  }
}

/**
 * The sum of the claimed amounts, when there is one, then, by currency in alphabetical order, the
 * sum of the foreign amounts of the expenses without a claimed amount.
 */
function totalOf(expenses: readonly Expense[]): readonly string[] {
  const claimed = expenses.flatMap((expense) => expense.claimedAmount ?? [])
  const foreign = new Map<Currency, Amount[]>()
  for (const { claimedAmount, foreignAmount, currency } of expenses) {
    if (claimedAmount === undefined && foreignAmount !== undefined && currency !== undefined) {
      foreign.set(currency, [...(foreign.get(currency) ?? []), foreignAmount])
    }
  }
  const sum = (amounts: readonly Amount[]) => amounts.reduce((total, amount) => total.plus(amount))
  const currencies = [...foreign.keys()].sort((one, other) => one.code.localeCompare(other.code))
  return [
    ...(claimed.length > 0 ? [sum(claimed).toString()] : []),
    ...currencies.map((currency) => sum(foreign.get(currency) ?? []).inCurrency(currency)),
  ]
}
