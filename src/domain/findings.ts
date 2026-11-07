import type { Expense } from './expense.ts'
import type { Report } from './report.ts'

/** The step of the wizard a finding is about. */
export type FindingStep = 'Report' | 'Expenses'

/** Something that stands between the draft and its report document, worded for the Claimant. */
export interface Finding {
  readonly step: FindingStep
  readonly wording: string
}

/** The name of each field of the report and of an expense, as the interface and findings say it. */
export const fieldNames = {
  claimantName: 'Name of claimant',
  position: 'Position',
  email: 'Email',
  supervisorName: 'Supervisor',
  supervisorEmail: "Supervisor's email",
  hostName: 'Host',
  hostEmail: "Host's email",
  purpose: 'Purpose',
  firstDay: 'First day',
  lastDay: 'Last day',
  account: 'Account',
  date: 'Date',
  description: 'Description',
  claimedAmount: 'Claimed amount (CAD)',
  receipts: 'Receipt',
  bankStatements: 'Bank statement',
} as const

/** A field of the report or of an expense. */
export type Field = keyof typeof fieldNames

/** What a field needs besides being filled in, shown next to it; absent when nothing more. */
export const fieldRules: Partial<Record<Field, string>> = {
  email: 'An email address.',
  supervisorEmail: 'An email address.',
  hostEmail: 'An email address.',
  lastDay: 'Not before the first day.',
  description: 'For a meal not only for the claimant, the attendees and their affiliations.',
  claimedAmount: 'In Canadian dollars, more than zero, at most two decimals.',
  receipts: 'A PDF, a JPEG image or a PNG image.',
  bankStatements: 'A PDF, a JPEG image or a PNG image.',
}

/** The fields that are optional; every other field, when asked, is required. */
const optionalFields: ReadonlySet<Field> = new Set<Field>(['firstDay', 'lastDay'])

/** Whether a field must be filled in, marked with an asterisk next to its name. */
export function isRequired(field: Field): boolean {
  return !optionalFields.has(field)
}

/** An expense, by its date and description. */
function expenseWording(expense: Expense): string {
  const date = expense.date?.toString() ?? 'without date'
  const description = expense.description ?? 'without description'
  return `Expense ${date}, ${description}`
}

function missing(step: FindingStep, field: Field, expense?: Expense): Finding {
  const subject = expense === undefined ? '' : `${expenseWording(expense)}: `
  return { step, wording: `${subject}${fieldNames[field]} is required.` }
}

/** The required fields of the Report step that are missing, and a last day before the first. */
export function findingsOfReportStep(report: Report): readonly Finding[] {
  const required: [Field, unknown][] = [
    ['claimantName', report.claimantName],
    ['position', report.position],
    ['email', report.email],
  ]
  if (report.asksForSupervisor) {
    required.push(['supervisorName', report.supervisorName])
    required.push(['supervisorEmail', report.supervisorEmail])
  }
  if (report.asksForHost) {
    required.push(['hostName', report.hostName])
    required.push(['hostEmail', report.hostEmail])
  }
  required.push(['purpose', report.purpose], ['account', report.account])
  const findings = required
    .filter(([, value]) => value === undefined)
    .map(([field]) => missing('Report', field))
  const { firstDay, lastDay } = report
  if (firstDay !== undefined && lastDay?.isBefore(firstDay)) {
    findings.push({ step: 'Report', wording: 'Last day is before the first day.' })
  }
  return findings
}

/** No expense, or an expense that breaks a rule of the Expenses step. */
export function findingsOfExpensesStep(report: Report): readonly Finding[] {
  if (report.expenses.length === 0) {
    return [{ step: 'Expenses', wording: 'No expense is claimed.' }]
  }
  return report.expenses.flatMap((expense) => {
    const absent: Field[] = []
    if (expense.date === undefined) absent.push('date')
    if (expense.description === undefined) absent.push('description')
    if (expense.claimedAmount === undefined) absent.push('claimedAmount')
    if (!expense.hasReceipt) absent.push('receipts')
    if (!expense.hasBankStatement) absent.push('bankStatements')
    return absent.map((field) => missing('Expenses', field, expense))
  })
}

/** Every finding of the report: a report with none can be saved as a report document. */
export function findingsOf(report: Report): readonly Finding[] {
  return [...findingsOfReportStep(report), ...findingsOfExpensesStep(report)]
}
