import type { Amount } from './amount.ts'
import type { CalendarDate } from './calendar-date.ts'
import { Currency } from './currency.ts'
import type { Document } from './document.ts'
import { Expense } from './expense.ts'
import { fieldNames, findingsOf } from './findings.ts'
import { Kind } from './kind.ts'
import type { MissingReceipt } from './missing-receipt.ts'
import type { PerDiem } from './per-diem.ts'
import { type PolicyDocument, policy } from './policy.ts'
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

/**
 * What stands under an expense on the cover: a document supporting it, called by its kind, and a
 * link to it by its label; a missing receipt authorization, the same, with no file behind it; or
 * Paid in cash where its bank statement would be, which is no link.
 */
export interface SupportingDocument {
  readonly label?: string
  readonly name: string
  readonly document?: Document
}

/** A line of the total, in one currency. */
export interface TotalLine {
  /** CAD, or the code of another currency. */
  readonly currencyCode: string
  /** The amount as 1,012.35, without its currency. */
  readonly amount: string
}

/** A row of the cover's table of expenses: an expense, or a per diem with a meal claimed. */
export interface ExpenseRow {
  readonly number: number
  readonly date: string
  readonly description: string
  readonly foreignAmount: string
  readonly claimedAmount: string
  /** What supports the expense, in the order of the report document. */
  readonly supportingDocuments: readonly SupportingDocument[]
  /** The per diem of a row that is one; none for an expense. */
  readonly perDiem?: PerDiem
  /**
   * Under a per diem, Not claimed: and its other meals, each followed by its reason in
   * parentheses when it has one; empty when every meal is claimed, and for an expense.
   */
  readonly mealsNotClaimed: string
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

/** What a section holds of a document or of a form: its label, and the expenses it supports. */
interface Labelled {
  readonly label: string
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

/** A document of a section. */
export interface LabelledDocument extends Labelled {
  readonly document: Document
}

/** What a missing receipt authorization writes, each field as the form names it. */
export interface MissingReceiptAuthorization {
  readonly reason: string
  readonly paidTo: string
  readonly dated: string
  /**
   * The claimed amount; for an expense paid in another currency, the foreign amount follows in
   * parentheses, or stands alone when the expense has no claimed amount. Each names its currency.
   */
  readonly amount: string
  readonly description: string
  readonly printedName: string
  readonly title: string
  /** Blank when not given. */
  readonly extension: string
  readonly email: string
}

/** A missing receipt authorization of its section: written for one expense, it has no name. */
export interface LabelledAuthorization extends Labelled {
  readonly expense: Expense
  readonly authorization: MissingReceiptAuthorization
}

/** What a section holds: a document the Claimant added, or a form the system writes. */
export type SectionEntry = LabelledDocument | LabelledAuthorization

/**
 * What a section page calls what it holds: a document by its name, a missing receipt authorization
 * by who was paid.
 */
export function nameOf(entry: SectionEntry): string {
  return 'document' in entry ? entry.document.name : entry.authorization.paidTo
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
  /** What its section page heads the column of names with: Name, or Payee for a form, which has none. */
  readonly nameColumn: string
  /** Whether its section page lists the expenses each document supports. */
  readonly listsExpenses: boolean
  /** Its documents, in order. */
  readonly documents: readonly SectionEntry[]
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
  /**
   * Every expense and every per diem with a meal claimed, sorted by date, the expenses of a day in
   * the order they were added and its per diem after them, and numbered in that order.
   */
  readonly expenses: readonly ExpenseRow[]
  /**
   * The total, one amount per line: the sum of the claimed amounts and of the domestic per diems,
   * when there is one, then, by currency in alphabetical order, the sum of the foreign amounts of
   * the expenses without a claimed amount, US dollars including the international per diems.
   */
  readonly total: readonly TotalLine[]
  /** The documents of the policy, in the section beside the attached information. */
  readonly policyDocuments: readonly PolicyDocument[]
  readonly sections: readonly Section[]
}

/** A report without findings, with every required field there. */
interface Complete {
  readonly claimantName: string
  readonly position: string
  readonly email: string
  readonly purpose: string
  readonly accountName: string
}

/**
 * The layout of the report document of a report. Throws a TypeError when the report has
 * findings: only a report without findings has a report document.
 */
export function layoutOf(report: Report): Layout {
  const complete = completeReport(report)
  const expenses = report.expensesByDate
  const entries = entriesOf(expenses, report.claimedPerDiems)
  const numbered = entries.flatMap((entry, index) =>
    entry instanceof Expense ? [{ expense: entry, number: index + 1 }] : [],
  )
  const sections = [
    sectionOfAdditionalDocuments(report),
    sectionOf(Kind.receipt, numbered),
    sectionOfAuthorizations(complete, numbered),
    sectionOf(Kind.bankStatement, numbered),
  ].filter((section) => section.documents.length > 0)
  const labels = new Map<Document | Expense, string>(
    sections.flatMap((section) =>
      section.documents.map(
        (entry) => ['document' in entry ? entry.document : entry.expense, entry.label] as const,
      ),
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
    expenses: entries.map((entry, index) =>
      entry instanceof Expense ? rowOf(entry, index + 1, labels) : perDiemRowOf(entry, index + 1),
    ),
    total: totalOf(expenses, report.claimedPerDiems),
    policyDocuments: policy.documents,
    sections,
  }
}

/** The meals of a per diem claimed in one currency, as a row of the cover. */
interface PerDiemEntry {
  readonly perDiem: PerDiem
  readonly date: CalendarDate
  /** Whether the row is of the international meals of its day; of its domestic ones otherwise. */
  readonly areInternational: boolean
  /** Whether the row is the last of its day, under which its meals not claimed are named. */
  readonly isLastOfDay: boolean
}

/** An expense or a per diem's meals in one currency, as the cover numbers them. */
type Entry = Expense | PerDiemEntry

/**
 * A per diem as rows of the cover: one for its domestic meals claimed, then one for its
 * international ones, each when there is one.
 */
function entriesOfPerDiem(perDiem: PerDiem): PerDiemEntry[] {
  const scopes = [false, true].filter(
    (areInternational) => perDiem.mealsClaimedThat(areInternational).length > 0,
  )
  return scopes.map((areInternational, index) => ({
    perDiem,
    date: perDiem.date,
    areInternational,
    isLastOfDay: index === scopes.length - 1,
  }))
}

/**
 * The expenses and the per diems, sorted by date, the expenses of a day in the order they were
 * added and its per diem after them, its domestic meals then its international ones; an expense
 * without a date last.
 */
function entriesOf(expenses: readonly Expense[], perDiems: readonly PerDiem[]): readonly Entry[] {
  const dateOf = (entry: Entry) => entry.date
  return [...expenses, ...perDiems.flatMap(entriesOfPerDiem)].sort((one, other) => {
    const oneDate = dateOf(one)
    const otherDate = dateOf(other)
    if (oneDate === undefined || otherDate === undefined) {
      return Number(oneDate === undefined) - Number(otherDate === undefined)
    }
    return (
      oneDate.compareTo(otherDate) ||
      Number(!(one instanceof Expense)) - Number(!(other instanceof Expense))
    )
  })
}

function completeReport(report: Report): Complete {
  const findings = findingsOf(report)
  const { claimantName, position, email, purpose, accountName } = report
  if (
    findings.length > 0 ||
    claimantName === undefined ||
    position === undefined ||
    email === undefined ||
    purpose === undefined ||
    accountName === undefined
  ) {
    throw new TypeError('Only a report without findings has a report document')
  }
  return { claimantName, position, email, purpose, accountName }
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

/**
 * The fields of the cover: the purpose first, with the dates and the locations of a business
 * travel; then the claimant's name, position and email, the supervisor of a student or a
 * postdoctoral fellow, the host of a visitor; then the account, its name followed by its code in
 * parentheses when it is given.
 */
function coverFieldsOf(report: Report, complete: Complete): CoverField[] {
  const fields: CoverField[] = [{ name: fieldNames.purpose, value: complete.purpose }]
  const dates = report.isBusinessTravel ? datesOf(report.firstDay, report.lastDay) : undefined
  if (dates !== undefined) {
    fields.push({ name: 'Dates', value: dates })
  }
  if (report.isBusinessTravel && report.locations !== undefined) {
    fields.push({ name: fieldNames.locations, value: report.locations })
  }
  fields.push(
    { name: fieldNames.claimantName, value: complete.claimantName },
    { name: fieldNames.position, value: complete.position },
    { name: fieldNames.email, value: complete.email },
  )
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
  const code = report.accountCode === undefined ? '' : ` (${report.accountCode})`
  fields.push({ name: 'Account', value: `${complete.accountName}${code}` })
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

/** An expense, and its number on the cover. */
interface NumberedExpense {
  readonly expense: Expense
  readonly number: number
}

/**
 * The section of a kind: its documents by the number of the first expense they support, then in
 * the order they were added, each in the report once whatever the number of expenses it supports.
 */
function sectionOf(kind: Kind, expenses: readonly NumberedExpense[]): Section {
  const supported = new Map<Document, StampedExpense[]>()
  for (const { expense, number } of expenses) {
    const documents = kind === Kind.receipt ? expense.receipts : expense.bankStatements
    const stamped = stampedExpenseOf(expense, number)
    for (const document of documents) {
      supported.set(document, [...(supported.get(document) ?? []), stamped])
    }
  }
  const documents = [...supported].map(([document, stamped], rank) => ({
    label: `${kind.letter}${rank + 1}`,
    document,
    expenseNumbers: stamped.map((expense) => expense.number),
    expenses: stamped,
  }))
  return {
    kind,
    title: kind.plural,
    nameColumn: 'Name',
    listsExpenses: true,
    documents,
    subsections: [],
  }
}

/** The section of the missing receipt authorizations: one per expense with a missing receipt. */
function sectionOfAuthorizations(
  complete: Complete,
  expenses: readonly NumberedExpense[],
): Section {
  const kind = Kind.missingReceiptAuthorization
  const documents = expenses
    .flatMap(({ expense, number }) =>
      expense.missingReceipt === undefined
        ? []
        : [{ expense, number, missing: expense.missingReceipt }],
    )
    .map(({ expense, number, missing }, rank) => ({
      label: `${kind.letter}${rank + 1}`,
      expense,
      expenseNumbers: [number],
      expenses: [stampedExpenseOf(expense, number)],
      authorization: authorizationOf(complete, expense, missing),
    }))
  return {
    kind,
    title: kind.plural,
    nameColumn: 'Payee',
    listsExpenses: true,
    documents,
    subsections: [],
  }
}

/** What the missing receipt authorization of an expense writes, filled in from the report. */
function authorizationOf(
  complete: Complete,
  expense: Expense,
  missing: MissingReceipt,
): MissingReceiptAuthorization {
  const claimed = expense.claimedAmount && `CAD ${expense.claimedAmount.grouped}`
  const foreign = expense.foreignAmountText
  const inParentheses = claimed !== undefined && foreign !== '' ? ` (${foreign})` : ''
  return {
    reason: missing.reason,
    paidTo: missing.paidTo,
    dated: expense.date?.toString() ?? '',
    amount: `${claimed ?? foreign}${inParentheses}`,
    description: expense.description ?? '',
    printedName: complete.claimantName,
    title: missing.jobTitle,
    extension: missing.phoneExtension ?? '',
    email: complete.email,
  }
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
  return {
    kind,
    title: kind.plural,
    nameColumn: 'Name',
    listsExpenses: false,
    documents,
    subsections,
  }
}

/** Expense 1: and the first 30 characters of its description, an ellipsis when it is longer. */
function stampedExpenseOf(expense: Expense, number: number): StampedExpense {
  const description = cut(expense.description ?? '')
  return { number, description, name: `Expense ${number}: ${description}` }
}

/**
 * A text as a stamp keeps it, on one line: its line breaks and tabs as spaces, then its first 30
 * characters, an ellipsis when it is longer.
 */
function cut(text: string): string {
  const oneLine = text
    .split(/\r\n|[\n\r\t]/)
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

function rowOf(
  expense: Expense,
  number: number,
  labels: Map<Document | Expense, string>,
): ExpenseRow {
  const linkOf = (document: Document): SupportingDocument => ({
    label: labels.get(document) ?? '',
    name: document.kind.coverName,
    document,
  })
  const supporting = [
    ...expense.receipts.map(linkOf),
    ...(expense.missingReceipt === undefined
      ? []
      : [
          {
            label: labels.get(expense) ?? '',
            name: Kind.missingReceiptAuthorization.coverName,
          },
        ]),
    ...expense.bankStatements.map(linkOf),
    ...(expense.isPaidInCash ? [{ name: fieldNames.paidInCash }] : []),
  ]
  return {
    number,
    date: expense.date?.toString() ?? '',
    description: expense.description ?? '',
    foreignAmount: expense.foreignAmountText,
    claimedAmount: expense.claimedAmount?.toString() ?? '',
    supportingDocuments: supporting,
    mealsNotClaimed: '',
  }
}

/**
 * The row of a per diem's meals claimed in one currency: Per diem, domestic or international,
 * then those meals; the sum of their rates the claimed amount of domestic meals, the foreign
 * amount, in US dollars, of international ones; under the last row of the day, its meals not
 * claimed and their reasons. No document supports it.
 */
function perDiemRowOf(entry: PerDiemEntry, number: number): ExpenseRow {
  const { perDiem, areInternational } = entry
  const amount = perDiem.amountOfMealsThat(areInternational)
  return {
    number,
    date: perDiem.date.toString(),
    description: perDiemDescriptionOf(perDiem, areInternational),
    foreignAmount: areInternational ? (amount?.inCurrency(Currency.usDollar) ?? '') : '',
    claimedAmount: areInternational ? '' : (amount?.toString() ?? ''),
    supportingDocuments: [],
    perDiem,
    mealsNotClaimed: entry.isLastOfDay ? mealsNotClaimedOf(perDiem) : '',
  }
}

/**
 * Per diem, domestic or international, then the meals of a per diem claimed that are, in the
 * order of a day.
 */
export function perDiemDescriptionOf(perDiem: PerDiem, areInternational: boolean): string {
  const scope = areInternational ? 'international' : 'domestic'
  const meals = perDiem.mealsClaimedThat(areInternational).map((meal) => meal.name)
  return `Per diem, ${scope}: ${meals.join(', ')}`
}

/**
 * The descriptions of a per diem's meals claimed, one per currency: its domestic meals, then its
 * international ones.
 */
export function perDiemDescriptionsOf(perDiem: PerDiem): readonly string[] {
  return [false, true]
    .filter((areInternational) => perDiem.mealsClaimedThat(areInternational).length > 0)
    .map((areInternational) => perDiemDescriptionOf(perDiem, areInternational))
}

/**
 * Not claimed: and the meals of a per diem not claimed, each followed by its reason in
 * parentheses when it has one; empty when every meal is claimed.
 */
export function mealsNotClaimedOf(perDiem: PerDiem): string {
  const meals = perDiem.mealsNotClaimed.map((meal) => {
    const reason = perDiem.reasonFor(meal)
    return reason === undefined ? meal.name : `${meal.name} (${reason})`
  })
  return meals.length > 0 ? `Not claimed: ${meals.join(', ')}` : ''
}

/**
 * The sum of the claimed amounts and of the domestic per diems, when there is one, then, by
 * currency in alphabetical order, the sum of the foreign amounts of the expenses without a claimed
 * amount, US dollars including the international per diems.
 */
export function totalOf(
  expenses: readonly Expense[],
  perDiems: readonly PerDiem[],
): readonly TotalLine[] {
  const claimed = expenses.flatMap((expense) => expense.claimedAmount ?? [])
  const foreign = new Map<Currency, Amount[]>()
  const addForeign = (currency: Currency, amount: Amount) =>
    foreign.set(currency, [...(foreign.get(currency) ?? []), amount])
  for (const { claimedAmount, foreignAmount, currency } of expenses) {
    if (claimedAmount === undefined && foreignAmount !== undefined && currency !== undefined) {
      addForeign(currency, foreignAmount)
    }
  }
  for (const perDiem of perDiems) {
    const domestic = perDiem.amountOfMealsThat(false)
    if (domestic !== undefined) {
      claimed.push(domestic)
    }
    const international = perDiem.amountOfMealsThat(true)
    if (international !== undefined) {
      addForeign(Currency.usDollar, international)
    }
  }
  const sum = (amounts: readonly Amount[]) => amounts.reduce((total, amount) => total.plus(amount))
  const currencies = [...foreign.keys()].sort((one, other) => one.code.localeCompare(other.code))
  const lineOf = (currencyCode: string, amount: Amount): TotalLine => ({
    currencyCode,
    amount: amount.grouped,
  })
  return [
    ...(claimed.length > 0 ? [lineOf('CAD', sum(claimed))] : []),
    ...currencies.map((currency) => lineOf(currency.code, sum(foreign.get(currency) ?? []))),
  ]
}
