import type { CalendarDate } from './calendar-date.ts'
import type { Expense } from './expense.ts'
import { isEmailAddress } from './text.ts'

/** What the claimant is at McSCert. */
export type Position = 'Faculty' | 'Postdoctoral fellow' | 'Student' | 'Staff' | 'Visitor'

/** Every position, in the order they are offered. */
export const positions: readonly Position[] = [
  'Faculty',
  'Postdoctoral fellow',
  'Student',
  'Staff',
  'Visitor',
]

/** What a report is made of; a field the Claimant has not filled in is absent. */
export interface ReportFields {
  readonly claimantName?: string | undefined
  readonly position?: Position | undefined
  readonly email?: string | undefined
  readonly supervisorName?: string | undefined
  readonly supervisorEmail?: string | undefined
  readonly hostName?: string | undefined
  readonly hostEmail?: string | undefined
  readonly event?: string | undefined
  readonly firstDay?: CalendarDate | undefined
  readonly lastDay?: CalendarDate | undefined
  readonly account?: string | undefined
  readonly expenses?: readonly Expense[] | undefined
}

/**
 * What the Claimant prepares: the claimant's name, position and email, the supervisor of a
 * student or a postdoctoral fellow, or the host of a visitor, the event, the dates of the event, the account and the
 * expenses. An email, when given, is an email address.
 */
export class Report {
  readonly claimantName: string | undefined
  readonly position: Position | undefined
  readonly email: string | undefined
  readonly supervisorName: string | undefined
  readonly supervisorEmail: string | undefined
  readonly hostName: string | undefined
  readonly hostEmail: string | undefined
  readonly event: string | undefined
  readonly firstDay: CalendarDate | undefined
  readonly lastDay: CalendarDate | undefined
  readonly account: string | undefined
  readonly expenses: readonly Expense[]

  /** Throws a TypeError when an email given is not an email address. */
  constructor(fields: ReportFields = {}) {
    for (const email of [fields.email, fields.supervisorEmail, fields.hostEmail]) {
      if (email !== undefined && !isEmailAddress(email)) {
        throw new TypeError(`${email} is not an email address`)
      }
    }
    this.claimantName = fields.claimantName
    this.position = fields.position
    this.email = fields.email
    this.supervisorName = fields.supervisorName
    this.supervisorEmail = fields.supervisorEmail
    this.hostName = fields.hostName
    this.hostEmail = fields.hostEmail
    this.event = fields.event
    this.firstDay = fields.firstDay
    this.lastDay = fields.lastDay
    this.account = fields.account
    this.expenses = fields.expenses ?? []
  }

  /** Whether the report asks for a supervisor: it does of a student or a postdoctoral fellow. */
  get asksForSupervisor(): boolean {
    return this.position === 'Student' || this.position === 'Postdoctoral fellow'
  }

  /** Whether the report asks for a host: it does of a visitor. */
  get asksForHost(): boolean {
    return this.position === 'Visitor'
  }

  /**
   * The same report, with the fields given changed. Choosing another position takes the
   * supervisor or the host out of the report.
   */
  afterChanging(changes: ReportFields): Report {
    const changed = new Report({ ...this.fields(), ...changes })
    if (changes.position === undefined || changes.position === this.position) {
      return changed
    }
    return new Report({
      ...changed.fields(),
      supervisorName: changed.asksForSupervisor ? changed.supervisorName : undefined,
      supervisorEmail: changed.asksForSupervisor ? changed.supervisorEmail : undefined,
      hostName: changed.asksForHost ? changed.hostName : undefined,
      hostEmail: changed.asksForHost ? changed.hostEmail : undefined,
    })
  }

  /** The same report, claiming one more expense. */
  afterAdding(expense: Expense): Report {
    return new Report({ ...this.fields(), expenses: [...this.expenses, expense] })
  }

  /** The same report, with one of its expenses replaced by another. */
  afterReplacing(expense: Expense, replacement: Expense): Report {
    const expenses = this.expenses.map((claimed) => (claimed === expense ? replacement : claimed))
    return new Report({ ...this.fields(), expenses })
  }

  private fields(): ReportFields {
    return {
      claimantName: this.claimantName,
      position: this.position,
      email: this.email,
      supervisorName: this.supervisorName,
      supervisorEmail: this.supervisorEmail,
      hostName: this.hostName,
      hostEmail: this.hostEmail,
      event: this.event,
      firstDay: this.firstDay,
      lastDay: this.lastDay,
      account: this.account,
      expenses: this.expenses,
    }
  }
}
