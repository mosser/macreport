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
  event: 'Event',
  firstDay: 'First day of the event',
  lastDay: 'Last day of the event',
  account: 'Account',
  date: 'Date',
  description: 'Description',
  claimedAmount: 'Claimed amount (CAD)',
  receipts: 'Receipt',
  bankStatements: 'Bank statement',
} as const

/** What each field needs, shown next to it and in its finding. */
export const fieldRules = {
  claimantName: 'Required.',
  position: 'Required, one of Faculty, Postdoctoral fellow, Student, Staff, Visitor.',
  email: 'Required, an email address.',
  supervisorName: "Required: the supervisor's name.",
  supervisorEmail: 'Required, an email address.',
  hostName: "Required: the host's name.",
  hostEmail: 'Required, an email address.',
  event: 'Required.',
  firstDay: 'Required, a calendar date.',
  lastDay: 'Required, a calendar date, not before the first day.',
  account: 'Required, free text.',
  date: 'Required, a calendar date.',
  description:
    'Required. For a meal not only for the claimant, it lists the attendees and their affiliations.',
  claimedAmount: 'Required, in Canadian dollars, more than zero, at most two decimals.',
  receipts: 'Required, a PDF, a JPEG image or a PNG image.',
  bankStatements: 'Required, a PDF, a JPEG image or a PNG image.',
} as const

/** A field of the report or of an expense. */
export type Field = keyof typeof fieldNames

/** The finding of a field that is missing or does not follow its rule. */
function fieldFinding(step: FindingStep, field: Field, expense?: Expense): Finding {
  const subject = expense === undefined ? '' : `${expenseWording(expense)}: `
  return { step, wording: `${subject}${fieldNames[field]}: ${fieldRules[field]}` }
}

/** An expense, by its date and description. */
function expenseWording(expense: Expense): string {
  const date = expense.date?.toString() ?? 'without date'
  const description = expense.description ?? 'without description'
  return `Expense ${date}, ${description}`
}

/** The required fields of the Report step that are missing or invalid. */
export function findingsOfReportStep(report: Report): readonly Finding[] {
  const missing: Field[] = []
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
  required.push(['event', report.event], ['firstDay', report.firstDay])
  for (const [field, value] of required) {
    if (value === undefined) {
      missing.push(field)
    }
  }
  const lastDay = report.lastDay
  const firstDay = report.firstDay
  if (lastDay === undefined || (firstDay !== undefined && lastDay.isBefore(firstDay))) {
    missing.push('lastDay')
  }
  if (report.account === undefined) {
    missing.push('account')
  }
  return missing.map((field) => fieldFinding('Report', field))
}

/** No expense, or an expense that breaks a rule of the Expenses step. */
export function findingsOfExpensesStep(report: Report): readonly Finding[] {
  if (report.expenses.length === 0) {
    return [{ step: 'Expenses', wording: 'No expense is claimed.' }]
  }
  return report.expenses.flatMap((expense) => {
    const missing: Field[] = []
    if (expense.date === undefined) missing.push('date')
    if (expense.description === undefined) missing.push('description')
    if (expense.claimedAmount === undefined) missing.push('claimedAmount')
    if (!expense.hasReceipt) missing.push('receipts')
    if (!expense.hasBankStatement) missing.push('bankStatements')
    return missing.map((field) => fieldFinding('Expenses', field, expense))
  })
}

/** Every finding of the report: a report with none can be saved as a report document. */
export function findingsOf(report: Report): readonly Finding[] {
  return [...findingsOfReportStep(report), ...findingsOfExpensesStep(report)]
}
