import type { Document } from './document.ts'
import type { Expense } from './expense.ts'
import { Kind } from './kind.ts'
import type { Report } from './report.ts'
import { charactersNotWritableIn } from './writable-characters.ts'

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
  preset: 'Preset',
  date: 'Date',
  description: 'Description',
  claimedAmount: 'Claimed amount (CAD)',
  paidInAnotherCurrency: 'Paid in another currency',
  foreignAmount: 'Foreign amount',
  currency: 'Currency',
  receipts: 'Receipt',
  bankStatements: 'Bank statement',
  paidInCash: 'Paid in cash',
  missingReceipt: 'Missing receipt',
  reasonForMissingReceipt: 'Reason for missing original receipt',
  paidTo: 'Paid to',
  jobTitle: 'Your job title',
  phoneExtension: 'Phone extension',
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
  jobTitle: 'E.g., Associate Prof, Research Engineer, PhD Student.',
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

/** The rule of a date of a preset that cannot fall after today. */
export const notAfterTodayRule = 'Not after today.'

/** What is said under a receipt or a bank statement added again: the document already there is chosen. */
export function alreadyInReportWording(document: Document): string {
  return `Already in the report, as ${document.name}: chosen.`
}

/**
 * What the Claimant is told before stating a missing receipt: what follows from it, and, stressed,
 * what may come of it.
 */
export const missingReceiptNotice = {
  text: "McMaster's official Missing Receipt Authorization Form will be written on your behalf. You will have to sign it in the final PDF.",
  stressed: 'Accounts Payable may not accept it, and may return the report.',
} as const

/** Why a file is refused when it is added. */
export type RefusalReason = 'format' | 'damaged' | 'without pages' | 'password'

const refusalWordings: Readonly<Record<RefusalReason, string>> = {
  format: 'it is not a PDF, a JPEG image or a PNG image',
  damaged: 'it is damaged',
  'without pages': 'it is a PDF without pages',
  password: 'it needs a password to open',
}

/** What is said of a file refused when it is added, with the reason. */
export function refusalWording(fileName: string, reason: RefusalReason): string {
  return `${fileName} is refused: ${refusalWordings[reason]}.`
}

/**
 * What is said of a file refused for being a document of the report already, by its kind and its
 * name: a document has one kind, and is in the report once.
 */
export function refusedAsAlreadyInReportWording(fileName: string, document: Document): string {
  return `${fileName} is refused: it is already in the report, as ${document.kind.name} ${document.name}.`
}

/** What is said of a file that had to be unlocked to be read: a password protected it. */
export function unlockedWording(document: Document): string {
  return `${document.fileName} was protected by a password, and has been unlocked: the report document holds it without that protection.`
}

/** A file refused when it is added: its message says so, with the reason. */
export class RefusedFile extends Error {
  constructor(fileName: string, reason: RefusalReason) {
    super(refusalWording(fileName, reason))
    this.name = 'RefusedFile'
  }
}

/** What is said under the name of a document that a document before it already has. */
export const nameTakenWording = 'Another document already has this name.'

/** The fields that are optional; every other field, when asked, is required. */
const optionalFields: ReadonlySet<Field> = new Set<Field>([
  'businessTravel',
  'accountCode',
  'paidInAnotherCurrency',
  'paidInCash',
  'missingReceipt',
  'phoneExtension',
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
    ['receipts', expense.hasReceipt || expense.missingReceipt !== undefined || undefined],
    ['bankStatements', expense.hasBankStatement || expense.isPaidInCash || undefined],
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

/** The fields holding an email address: one typed that is not stays out of the report, as if empty. */
const emailFields: ReadonlySet<Field> = new Set<Field>(['email', 'supervisorEmail', 'hostEmail'])

/**
 * The required fields of the Report step that are missing or invalid, the dates and the locations
 * of a business travel among them, and a last day before the first.
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
    .map(
      ([field]): Finding =>
        emailFields.has(field)
          ? { step: 'Report', wording: `${fieldNames[field]} is required, as an email address.` }
          : missing('Report', field),
    )
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

/** A character as a finding names it: itself, and its code, as an invisible one has nothing else. */
function characterWording(character: string): string {
  const code = (character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')
  return `${character} (U+${code})`
}

/** A text the report document writes: what it is, as a finding names it, and its value. */
interface WrittenText {
  readonly step: FindingStep
  /** The expense, the per diem or the document the text is of, followed by a colon; empty otherwise. */
  readonly subject: string
  readonly field: Field
  readonly value: string | undefined
}

/** The fields of the report the report document writes as the Claimant typed them. */
const writtenReportFields = [
  'claimantName',
  'email',
  'supervisorName',
  'supervisorEmail',
  'hostName',
  'hostEmail',
  'purpose',
  'locations',
  'accountName',
  'accountCode',
] as const

/**
 * Every text the Claimant gave that the report document writes: the fields of the report, the
 * description of each expense and what its missing receipt states, the reason of each meal not
 * claimed of a day with a meal claimed, and the name of each document.
 */
function writtenTextsOf(report: Report): readonly WrittenText[] {
  return [
    ...writtenReportFields.map(
      (field): WrittenText => ({ step: 'Report', subject: '', field, value: report[field] }),
    ),
    ...report.expensesByDate.flatMap((expense) => {
      const missing = expense.missingReceipt
      const fields: readonly [Field, string | undefined][] = [
        ['description', expense.description],
        ['reasonForMissingReceipt', missing?.reason],
        ['paidTo', missing?.paidTo],
        ['jobTitle', missing?.jobTitle],
        ['phoneExtension', missing?.phoneExtension],
      ]
      return fields.map(
        ([field, value]): WrittenText => ({
          step: 'Expenses',
          subject: `${expenseWording(expense)}: `,
          field,
          value,
        }),
      )
    }),
    ...report.claimedPerDiems.flatMap((perDiem) =>
      perDiem.mealsNotClaimed.map(
        (meal): WrittenText => ({
          step: 'Expenses',
          subject: `Per diem ${perDiem.date}, ${meal.name}: `,
          field: 'reason',
          value: perDiem.reasonFor(meal),
        }),
      ),
    ),
    ...report.documents.map(
      (document): WrittenText => ({
        step: document.kind === Kind.additionalDocument ? 'Additional documents' : 'Expenses',
        subject: `${document.kind.name} ${document.fileName}: `,
        field: 'documentName',
        value: document.name,
      }),
    ),
  ]
}

/**
 * The texts holding a character the report document cannot write: never replaced silently, the
 * Claimant decides how to write it. Each stands between the report and its report document, and
 * holds no step: it is found on the Review step.
 */
export function findingsOfCharacters(report: Report): readonly Finding[] {
  return writtenTextsOf(report).flatMap(({ step, subject, field, value }) => {
    const characters = charactersNotWritableIn(value ?? '')
    if (characters.length === 0) return []
    const holds = characters.length === 1 ? 'a character' : 'characters'
    const named = characters.map(characterWording).join(', ')
    return [
      {
        step,
        wording: `${subject}${fieldNames[field]} holds ${holds} the report document cannot write: ${named}.`,
      },
    ]
  })
}

/** Every finding of the report: a report with none can be saved as a report document. */
export function findingsOf(report: Report): readonly Finding[] {
  return [
    ...findingsOfReportStep(report),
    ...findingsOfExpensesStep(report),
    ...findingsOfAdditionalDocumentsStep(report),
    ...findingsOfCharacters(report),
  ]
}
