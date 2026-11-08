import type { Document } from './document.ts'
import type { Expense } from './expense.ts'
import type { Report } from './report.ts'

/** The step of the wizard a finding is about. */
export type FindingStep = 'Report' | 'Expenses' | 'Additional documents'

/** Something that stands between the draft and its report document, worded for the Claimant. */
export interface Finding {
  readonly step: FindingStep
  readonly wording: string
}

/**
 * The name of each field of the report, of an expense, of a document and of a per diem, as the
 * interface and findings say it.
 */
export const fieldNames = {
  claimantName: 'Name of claimant',
  position: 'Position',
  email: 'Email',
  supervisorName: 'Supervisor',
  supervisorEmail: "Supervisor's email",
  hostName: 'Host',
  hostEmail: "Host's email",
  purpose: 'Purpose',
  businessTravel: 'Business travel',
  firstDay: 'First day',
  lastDay: 'Last day',
  locations: 'Location(s)',
  accountName: 'Account name',
  accountCode: 'Account code',
  date: 'Date',
  description: 'Description',
  claimedAmount: 'Claimed amount (CAD)',
  paidInAnotherCurrency: 'Paid in another currency',
  foreignAmount: 'Foreign amount',
  currency: 'Currency',
  receipts: 'Receipt',
  bankStatements: 'Bank statement',
  travelJustifications: 'Travel justification(s)',
  additionalDocuments: 'Additional document(s)',
  documentName: 'Name',
  domestic: 'Domestic',
  international: 'International',
  perMeal: 'Per meal',
  reason: 'Reason',
} as const

/** A field of the report, of an expense, of a document or of a per diem. */
export type Field = keyof typeof fieldNames

/** What a field needs besides being filled in, shown next to it; absent when nothing more. */
export const fieldRules: Partial<Record<Field, string>> = {
  email: 'An email address.',
  supervisorEmail: 'An email address.',
  hostEmail: 'An email address.',
  lastDay: 'Not before the first day.',
  description: 'For a meal not only for the claimant, the attendees and their affiliations.',
  claimedAmount: 'In Canadian dollars, more than zero, at most two decimals.',
  foreignAmount: 'More than zero, at most two decimals.',
  currency: 'A three-letter ISO 4217 code, other than CAD.',
  receipts: 'A PDF, a JPEG image or a PNG image.',
  bankStatements: 'A PDF, a JPEG image or a PNG image.',
  travelJustifications:
    'An invitation letter, a conference programme: a PDF, a JPEG image or a PNG image.',
  additionalDocuments: 'A PDF, a JPEG image or a PNG image.',
}

/**
 * The rule of the claimed amount of an expense paid in another currency, which may have none:
 * McSCert then works it out from the foreign amount.
 */
export const claimedAmountInAnotherCurrencyRule =
  'In Canadian dollars, more than zero, at most two decimals; left empty, McSCert works it out.'

/** What is said under a receipt or a bank statement added again: the document already there is chosen. */
export function alreadyInReportWording(document: Document): string {
  return `Already in the report, as ${document.name}: chosen.`
}

/** What is said under the name of a document that a document before it already has. */
export const nameTakenWording = 'Another document already has this name.'

/** The fields that are optional; every other field, when asked, is required. */
const optionalFields: ReadonlySet<Field> = new Set<Field>([
  'businessTravel',
  'accountCode',
  'paidInAnotherCurrency',
  'additionalDocuments',
  'documentName',
  'domestic',
  'international',
  'perMeal',
  'reason',
])

/**
 * Whether a field must be filled in, marked with an asterisk next to its name: the claimed amount
 * of an expense paid in another currency is optional.
 */
export function isRequired(field: Field, expense?: Expense): boolean {
  if (field === 'claimedAmount' && expense?.isPaidInAnotherCurrency === true) return false
  return !optionalFields.has(field)
}

/** What is said of a required field left empty. */
export function requiredWording(field: Field): string {
  return `${fieldNames[field]} is required.`
}

/** The required fields of an expense that are missing, in the order of its fields. */
export function missingFieldsOf(expense: Expense): readonly Field[] {
  const values: [Field, unknown][] = [
    ['date', expense.date],
    ['description', expense.description],
    ['claimedAmount', expense.claimedAmount],
  ]
  if (expense.isPaidInAnotherCurrency) {
    values.push(['foreignAmount', expense.foreignAmount], ['currency', expense.currency])
  }
  values.push(
    ['receipts', expense.hasReceipt || undefined],
    ['bankStatements', expense.hasBankStatement || undefined],
  )
  return values
    .filter(([field, value]) => value === undefined && isRequired(field, expense))
    .map(([field]) => field)
}

/** An expense, by its date and description, as findings and confirmations name it. */
export function expenseWording(expense: Expense): string {
  const date = expense.date?.toString() ?? 'without date'
  const description = expense.description ?? 'without description'
  return `Expense ${date}, ${description}`
}

function missing(step: FindingStep, field: Field, expense?: Expense): Finding {
  const subject = expense === undefined ? '' : `${expenseWording(expense)}: `
  return { step, wording: `${subject}${requiredWording(field)}` }
}

/**
 * The required fields of the Report step that are missing, the dates and the locations of a
 * business travel among them, and a last day before the first.
 */
export function findingsOfReportStep(report: Report): readonly Finding[] {
  const required: [Field, unknown][] = [
    ['claimantName', report.claimantName],
    ['position', report.position],
    ['email', report.email],
  ]
  if (report.asksForSupervisor) {
    required.push(
      ['supervisorName', report.supervisorName],
      ['supervisorEmail', report.supervisorEmail],
    )
  }
  if (report.asksForHost) {
    required.push(['hostName', report.hostName], ['hostEmail', report.hostEmail])
  }
  required.push(['purpose', report.purpose])
  if (report.isBusinessTravel) {
    required.push(
      ['firstDay', report.firstDay],
      ['lastDay', report.lastDay],
      ['locations', report.locations],
    )
  }
  required.push(['accountName', report.accountName])
  const findings = required
    .filter(([, value]) => value === undefined)
    .map(([field]) => missing('Report', field))
  const { firstDay, lastDay } = report
  if (firstDay !== undefined && lastDay?.isBefore(firstDay)) {
    findings.push({ step: 'Report', wording: 'Last day is before the first day.' })
  }
  return findings
}

/** No expense and no meal claimed, or an expense that breaks a rule of the Expenses step. */
export function findingsOfExpensesStep(report: Report): readonly Finding[] {
  if (report.expenses.length === 0 && report.claimedPerDiems.length === 0) {
    return [{ step: 'Expenses', wording: 'No expense or per diem is claimed.' }]
  }
  const rules = report.expenses.flatMap((expense) =>
    missingFieldsOf(expense).map((field) => missing('Expenses', field, expense)),
  )
  const documents = report.expenses.flatMap((expense) => expense.documents)
  return [...rules, ...namesTaken('Expenses', report, documents)]
}

/**
 * A document named as a document before it, in the order of the steps, by its file name: no two
 * documents have the same name, whatever its case.
 */
function namesTaken(step: FindingStep, report: Report, documents: readonly Document[]): Finding[] {
  return [...new Set(documents)]
    .filter((document) => report.isNameTaken(document))
    .map((document) => ({ step, wording: nameTakenFindingOf(document) }))
}

/** A document named as a document before it, by its file name and its name. */
export function nameTakenFindingOf(document: Document): string {
  return `${document.fileName}: ${fieldNames.documentName} ${document.name} is already another document's.`
}

/**
 * What an expense still lacks, as its row in the list of expenses says it: each required field
 * missing, then each of its documents named as a document before it.
 */
export function lacksOf(report: Report, expense: Expense): readonly string[] {
  return [
    ...missingFieldsOf(expense).map(requiredWording),
    ...expense.documents.filter((document) => report.isNameTaken(document)).map(nameTakenFindingOf),
  ]
}

/** A business travel without a travel justification: it has at least one. */
export function findingsOfAdditionalDocumentsStep(report: Report): readonly Finding[] {
  const justification: Finding[] =
    report.isBusinessTravel && report.travelJustifications.length === 0
      ? [
          {
            step: 'Additional documents',
            wording: 'At least one travel justification is required.',
          },
        ]
      : []
  const documents = [...report.travelJustifications, ...report.additionalDocuments]
  return [...justification, ...namesTaken('Additional documents', report, documents)]
}

/** Every finding of the report: a report with none can be saved as a report document. */
export function findingsOf(report: Report): readonly Finding[] {
  return [
    ...findingsOfReportStep(report),
    ...findingsOfExpensesStep(report),
    ...findingsOfAdditionalDocumentsStep(report),
  ]
}
