import type { CalendarDate } from './calendar-date.ts'
import type { Document } from './document.ts'
import type { Expense } from './expense.ts'
import { Kind } from './kind.ts'
import type { MissingReceipt } from './missing-receipt.ts'
import { PerDiem, type PerDiemFields } from './per-diem.ts'
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
  readonly purpose?: string | undefined
  readonly isBusinessTravel?: boolean | undefined
  readonly firstDay?: CalendarDate | undefined
  readonly lastDay?: CalendarDate | undefined
  readonly locations?: string | undefined
  readonly accountName?: string | undefined
  readonly accountCode?: string | undefined
  readonly expenses?: readonly Expense[] | undefined
  readonly perDiems?: readonly PerDiem[] | undefined
  readonly travelJustifications?: readonly Document[] | undefined
  readonly additionalDocuments?: readonly Document[] | undefined
}

/**
 * What the Claimant prepares: the claimant's name, position and email, the supervisor of a
 * student or a postdoctoral fellow, or the host of a visitor, the purpose, its dates and its
 * locations, the account, by its name and its code when given, the expenses, the per diems, the travel justifications and the
 * additional documents. An email, when given, is an email address; a travel justification is an
 * additional document that justifies the travel, of the additional document kind as any other.
 * Only a business travel has per diems, one per day at most, between its dates once they are given.
 */
export class Report {
  readonly claimantName: string | undefined
  readonly position: Position | undefined
  readonly email: string | undefined
  readonly supervisorName: string | undefined
  readonly supervisorEmail: string | undefined
  readonly hostName: string | undefined
  readonly hostEmail: string | undefined
  readonly purpose: string | undefined
  /** Whether the purpose took the claimant away; only a business travel has dates. */
  readonly isBusinessTravel: boolean
  readonly firstDay: CalendarDate | undefined
  readonly lastDay: CalendarDate | undefined
  /** Where a business travel took the claimant, in the Claimant's words. */
  readonly locations: string | undefined
  /** The name of the account the Claimant suggests the expenses be charged to. */
  readonly accountName: string | undefined
  /** The code of that account, when the Claimant gives it. */
  readonly accountCode: string | undefined
  readonly expenses: readonly Expense[]
  /**
   * The per diems the Claimant changed, by date; a day of the business travel without one has a
   * per diem as it starts, domestic and without a meal claimed.
   */
  readonly perDiems: readonly PerDiem[]
  /** The documents justifying a business travel, in the order they were added. */
  readonly travelJustifications: readonly Document[]
  /** The other documents of the report as a whole, in the order they were added. */
  readonly additionalDocuments: readonly Document[]

  /**
   * Throws a TypeError when an email given is not an email address, or when a travel
   * justification or an additional document is a document of another kind.
   */
  constructor(fields: ReportFields = {}) {
    for (const email of [fields.email, fields.supervisorEmail, fields.hostEmail]) {
      if (email !== undefined && !isEmailAddress(email)) {
        throw new TypeError(`${email} is not an email address`)
      }
    }
    const travelJustifications = fields.travelJustifications ?? []
    const additionalDocuments = fields.additionalDocuments ?? []
    if (
      [...travelJustifications, ...additionalDocuments].some(
        (document) => document.kind !== Kind.additionalDocument,
      )
    ) {
      throw new TypeError('An additional document is a document of the additional document kind')
    }
    this.claimantName = fields.claimantName
    this.position = fields.position
    this.email = fields.email
    this.supervisorName = fields.supervisorName
    this.supervisorEmail = fields.supervisorEmail
    this.hostName = fields.hostName
    this.hostEmail = fields.hostEmail
    this.purpose = fields.purpose
    this.isBusinessTravel = fields.isBusinessTravel ?? false
    this.firstDay = fields.firstDay
    this.lastDay = fields.lastDay
    this.locations = fields.locations
    this.accountName = fields.accountName
    this.accountCode = fields.accountCode
    this.expenses = fields.expenses ?? []
    this.perDiems = this.isBusinessTravel
      ? perDiemsBetween(fields.perDiems ?? [], this.firstDay, this.lastDay)
      : []
    this.travelJustifications = travelJustifications
    this.additionalDocuments = additionalDocuments
  }

  /**
   * Every document of the report, each once, in the order of the steps: the receipts and bank
   * statements of its expenses, then its travel justifications and its additional documents.
   */
  get documents(): readonly Document[] {
    return [
      ...new Set([
        ...this.expenses.flatMap((expense) => [...expense.receipts, ...expense.bankStatements]),
        ...this.travelJustifications,
        ...this.additionalDocuments,
      ]),
    ]
  }

  /**
   * Whether a document of the report has a name a document before it already has, in the order
   * of the steps: no two documents have the same name, whatever its case.
   */
  isNameTaken(document: Document): boolean {
    const documents = this.documents
    const before = documents.slice(0, Math.max(documents.indexOf(document), 0))
    return before.some((other) => isSameName(other.name, document.name))
  }

  /** The name given if no document of the report has it, or that name followed by (2), (3)… */
  freeNameLike(name: string): string {
    const isTaken = (candidate: string) =>
      this.documents.some((document) => isSameName(document.name, candidate))
    let candidate = name
    let number = 1
    while (isTaken(candidate)) {
      number += 1
      candidate = `${name} (${number})`
    }
    return candidate
  }

  /**
   * The expenses sorted by date, then in the order they were added; an expense without a date
   * comes after those with one.
   */
  get expensesByDate(): readonly Expense[] {
    return [...this.expenses].sort((one, other) => {
      if (one.date === undefined || other.date === undefined) {
        return Number(one.date === undefined) - Number(other.date === undefined)
      }
      return one.date.compareTo(other.date)
    })
  }

  /**
   * Whether the report asks for per diems: it does of a business travel whose first and last day
   * are given, the last not before the first.
   */
  get asksForPerDiems(): boolean {
    const { firstDay, lastDay } = this
    return (
      this.isBusinessTravel &&
      firstDay !== undefined &&
      lastDay !== undefined &&
      !lastDay.isBefore(firstDay)
    )
  }

  /** Every day of a business travel that asks for per diems, from its first day to its last. */
  get days(): readonly CalendarDate[] {
    const { firstDay, lastDay } = this
    if (!this.asksForPerDiems || firstDay === undefined || lastDay === undefined) {
      return []
    }
    const days = [firstDay]
    for (let day = firstDay.dayAfter; !lastDay.isBefore(day); day = day.dayAfter) {
      days.push(day)
    }
    return days
  }

  /** The per diem of a day: the one the Claimant changed, or one as it starts. */
  perDiemOn(day: CalendarDate): PerDiem {
    return this.perDiems.find((perDiem) => perDiem.date.equals(day)) ?? new PerDiem(day)
  }

  /** The per diem of every day of the business travel, in the order of the days. */
  get perDiemsByDay(): readonly PerDiem[] {
    return this.days.map((day) => this.perDiemOn(day))
  }

  /** The per diems with a meal claimed, by date: one that claims no meal claims nothing. */
  get claimedPerDiems(): readonly PerDiem[] {
    return this.perDiems.filter((perDiem) => perDiem.hasMealClaimed)
  }

  /** The same report, with the per diem of a day replaced by the one given. */
  afterChangingPerDiem(perDiem: PerDiem): Report {
    const others = this.perDiems.filter((other) => !other.date.equals(perDiem.date))
    return new Report({ ...this.fields(), perDiems: [...others, perDiem] })
  }

  /** The same report, with the fields given changed in the per diem of every day: all domestic, all international. */
  afterChangingEveryPerDiem(changes: PerDiemFields): Report {
    const perDiems = this.perDiemsByDay.map((perDiem) => perDiem.afterChanging(changes))
    return new Report({ ...this.fields(), perDiems })
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
   * supervisor or the host out of the report; unticking business travel takes the dates, the
   * locations, the per diems and the travel justifications out. Changing the dates takes out the
   * per diems of the days no longer between them.
   */
  afterChanging(changes: ReportFields): Report {
    const changed = new Report({ ...this.fields(), ...changes })
    return new Report({
      ...changed.fields(),
      supervisorName: changed.asksForSupervisor ? changed.supervisorName : undefined,
      supervisorEmail: changed.asksForSupervisor ? changed.supervisorEmail : undefined,
      hostName: changed.asksForHost ? changed.hostName : undefined,
      hostEmail: changed.asksForHost ? changed.hostEmail : undefined,
      firstDay: changed.isBusinessTravel ? changed.firstDay : undefined,
      lastDay: changed.isBusinessTravel ? changed.lastDay : undefined,
      locations: changed.isBusinessTravel ? changed.locations : undefined,
      travelJustifications: changed.isBusinessTravel ? changed.travelJustifications : [],
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

  /**
   * The report New report starts: the claimant's name, position and email, the supervisor of a
   * student or a postdoctoral fellow, the host of a visitor, and nothing else; no purpose, dates,
   * locations, account, expense, per diem or document.
   */
  afterNewReport(): Report {
    return new Report({
      claimantName: this.claimantName,
      position: this.position,
      email: this.email,
      supervisorName: this.supervisorName,
      supervisorEmail: this.supervisorEmail,
      hostName: this.hostName,
      hostEmail: this.hostEmail,
    })
  }

  /**
   * The same report, without one of its expenses: a receipt or a bank statement no other expense
   * refers to leaves the report with it.
   */
  afterRemovingExpense(expense: Expense): Report {
    const expenses = this.expenses.filter((claimed) => claimed !== expense)
    return new Report({ ...this.fields(), expenses })
  }

  /**
   * The same report, with an expense put back as it was before it was changed: its fields, its
   * documents and their names. An expense that was not, being just added, leaves the report. A
   * document the changes took out comes back; one they added that no other expense refers to
   * leaves. Nothing else of the report changes.
   */
  afterPuttingBack(expense: Expense, before: Expense | undefined): Report {
    if (before === undefined) {
      return this.afterRemovingExpense(expense)
    }
    const inReport = (document: Document) => this.documentLike(document) ?? document
    const replaced = this.afterReplacing(
      expense,
      before.afterChanging({
        receipts: before.receipts.map(inReport),
        bankStatements: before.bankStatements.map(inReport),
      }),
    )
    return before.documents.reduce((report, document) => {
      const current = report.documentLike(document)
      return current === undefined || current.name === document.name
        ? report
        : report.afterRenaming(current, document.name)
    }, replaced)
  }

  /**
   * The missing receipt of the last expense added that has one: another missing receipt starts with
   * its job title and its phone extension.
   */
  get lastMissingReceipt(): MissingReceipt | undefined {
    return this.expenses.findLast((expense) => expense.missingReceipt !== undefined)?.missingReceipt
  }

  /** The receipts and bank statements that leave the report with an expense removed. */
  documentsLeavingWith(expense: Expense): readonly Document[] {
    const kept = new Set(this.afterRemovingExpense(expense).documents)
    return [...new Set(expense.documents)].filter((document) => !kept.has(document))
  }

  /** The documents of a kind in the report, each once, in the order of the steps. */
  documentsOf(kind: Kind): readonly Document[] {
    return this.documents.filter((document) => document.kind === kind)
  }

  /** The document of the report of the same kind and content as the one given, if there is one. */
  documentLike(document: Document): Document | undefined {
    return this.documentsOf(document.kind).find((other) => other.hasSameContentAs(document))
  }

  /** The same report, with a document named otherwise wherever it is. */
  afterRenaming(document: Document, name: string): Report {
    return this.afterReplacingDocument(document, [document.afterNaming(name)])
  }

  /** The same report, with a document reduced wherever it is. */
  afterReducing(document: Document): Report {
    return this.afterReplacingDocument(document, [document.afterReducing()])
  }

  /** The same report, with a document back to the file added wherever it is. */
  afterRestoring(document: Document): Report {
    return this.afterReplacingDocument(document, [document.afterRestoring()])
  }

  /** The same report, without a document: no expense refers to it, nor is it of the report. */
  afterRemovingDocument(document: Document): Report {
    return this.afterReplacingDocument(document, [])
  }

  private afterReplacingDocument(document: Document, replacement: readonly Document[]): Report {
    const among = (documents: readonly Document[]) =>
      documents.flatMap((each) => (each === document ? replacement : [each]))
    return new Report({
      ...this.fields(),
      expenses: this.expenses.map((expense) =>
        expense.afterChanging({
          receipts: among(expense.receipts),
          bankStatements: among(expense.bankStatements),
        }),
      ),
      travelJustifications: among(this.travelJustifications),
      additionalDocuments: among(this.additionalDocuments),
    })
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
      purpose: this.purpose,
      isBusinessTravel: this.isBusinessTravel,
      firstDay: this.firstDay,
      lastDay: this.lastDay,
      locations: this.locations,
      accountName: this.accountName,
      accountCode: this.accountCode,
      expenses: this.expenses,
      perDiems: this.perDiems,
      travelJustifications: this.travelJustifications,
      additionalDocuments: this.additionalDocuments,
    }
  }
}

/** Whether two names are the same, whatever their case. */
function isSameName(one: string, other: string): boolean {
  return one.toLocaleLowerCase('en') === other.toLocaleLowerCase('en')
}

/**
 * The per diems, one per day, the last given for a day kept, by date; once both dates are given,
 * the last not before the first, only those of the days between them.
 */
function perDiemsBetween(
  perDiems: readonly PerDiem[],
  firstDay: CalendarDate | undefined,
  lastDay: CalendarDate | undefined,
): readonly PerDiem[] {
  const isBetween = (day: CalendarDate) =>
    firstDay === undefined ||
    lastDay === undefined ||
    lastDay.isBefore(firstDay) ||
    (!day.isBefore(firstDay) && !lastDay.isBefore(day))
  const byDay = new Map(perDiems.map((perDiem) => [perDiem.date.toString(), perDiem]))
  return [...byDay.values()]
    .filter((perDiem) => isBetween(perDiem.date))
    .sort((one, other) => one.date.compareTo(other.date))
}
