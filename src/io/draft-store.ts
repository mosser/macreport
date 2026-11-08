import { Amount } from '../domain/amount.ts'
import { CalendarDate } from '../domain/calendar-date.ts'
import { Currency } from '../domain/currency.ts'
import { Document } from '../domain/document.ts'
import { Expense } from '../domain/expense.ts'
import { Kind } from '../domain/kind.ts'
import { Meal } from '../domain/meal.ts'
import { PerDiem } from '../domain/per-diem.ts'
import { positions, Report } from '../domain/report.ts'
import { isEmailAddress, textOrAbsent } from '../domain/text.ts'

/**
 * The draft: the report as the Claimant left it, kept by the browser (ADR 0008). Keeping it is
 * best effort: when the browser refuses, nothing is kept and everything else works.
 */
export interface DraftStore {
  /** Whether the browser keeps the draft; when it does not, closing the page loses the report. */
  readonly isKept: boolean
  /** The draft kept, or an empty report when there is none. */
  restore(): Promise<Report>
  /** Keeps the report as the draft, at once; gives whether the browser kept it. */
  keep(report: Report): Promise<boolean>
  /** Deletes the draft and every document's content, for New report; gives whether it did. */
  discard(): Promise<boolean>
}

const databaseName = 'macreport'
const databaseVersion = 2
const draftStore = 'draft'
const documentStore = 'documents'
const draftKey = 'report'

/** What IndexedDB keeps of an expense: its documents by their identifiers. */
interface ExpenseRecord {
  readonly date?: string
  readonly description?: string
  readonly claimedAmount?: number
  readonly isPaidInAnotherCurrency?: boolean
  readonly foreignAmount?: number
  readonly currency?: string
  readonly receipts: readonly string[]
  readonly bankStatements: readonly string[]
}

/**
 * What IndexedDB keeps of a per diem: its international meals and its meals claimed by their
 * names, its reasons by meal.
 */
interface PerDiemRecord {
  readonly date: string
  readonly internationalMeals: readonly string[]
  readonly mealsClaimed: readonly string[]
  readonly reasons: Readonly<Record<string, string>>
}

/**
 * What IndexedDB keeps of a document, once: its kind by its letter, its file name and its bytes.
 * Its name, which the Claimant changes as they type, is kept with the report.
 */
interface DocumentRecord {
  readonly letter: string
  readonly fileName: string
  readonly content: Uint8Array
}

function opened(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      for (const name of database.objectStoreNames) {
        database.deleteObjectStore(name)
      }
      database.createObjectStore(draftStore)
      database.createObjectStore(documentStore)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(failure(request.error))
    // Another page holds an older draft open: rather than wait for it, keep nothing this time.
    request.onblocked = () => reject(new Error('The draft is held open by another page'))
  })
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(failure(transaction.error))
    transaction.onabort = () => reject(failure(transaction.error))
  })
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(failure(request.error))
  })
}

/** Undoes what a transaction wrote, when it is still going. */
function abort(transaction: IDBTransaction | undefined): void {
  try {
    transaction?.abort()
  } catch {
    // Already finished, or already aborted: there is nothing left to undo.
  }
}

/** The error IndexedDB gives, or one saying it gave none. */
function failure(error: DOMException | null): Error {
  return error ?? new Error('The browser did not say why it failed')
}

const text = (value: unknown) => (typeof value === 'string' ? textOrAbsent(value) : undefined)
const email = (value: unknown) => {
  const typed = text(value)
  return typed !== undefined && isEmailAddress(typed) ? typed : undefined
}
const date = (value: unknown) => (typeof value === 'string' ? CalendarDate.parse(value) : undefined)
const identifiers = (value: unknown) =>
  Array.isArray(value) ? value.filter((each) => typeof each === 'string') : []

function amountOf(value: unknown): Amount | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? new Amount(value)
    : undefined
}

/** A store that keeps nothing: the browser refuses, or gives no IndexedDB. */
const nothingKept: DraftStore = {
  isKept: false,
  restore: async () => new Report(),
  keep: async () => false,
  discard: async () => true,
}

class IndexedDraftStore implements DraftStore {
  readonly isKept = true
  private readonly database: IDBDatabase
  /**
   * The identifier of each document, given when it is first kept, by its content: a document
   * named otherwise is a copy with the same content, and keeps its identifier.
   */
  private readonly identifiers = new WeakMap<Uint8Array, string>()
  /** The last write asked for: each waits for the one before it to finish. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(database: IDBDatabase) {
    this.database = database
  }

  /** Runs a write once the writes asked for before it have finished. */
  private inTurn<T>(write: () => Promise<T>): Promise<T> {
    const next = this.queue.then(write)
    this.queue = next.catch(() => undefined)
    return next
  }

  async restore(): Promise<Report> {
    try {
      const transaction = this.database.transaction([draftStore, documentStore], 'readonly')
      const record = await result(transaction.objectStore(draftStore).get(draftKey))
      const documents = new Map<string, Document>()
      const names = namesOf(record)
      const store = transaction.objectStore(documentStore)
      const [keys, records] = await Promise.all([
        result(store.getAllKeys()),
        result(store.getAll()),
      ])
      keys.forEach((key, index) => {
        if (typeof key !== 'string') return
        const document = this.documentOf(key, records[index], names.get(key))
        if (document !== undefined) documents.set(key, document)
      })
      return reportOf(record, documents)
    } catch {
      return new Report()
    }
  }

  /**
   * Keeps the report, all of it or nothing: a write that fails is undone. Writes are kept one
   * after the other, so that each knows the identifiers the one before it gave.
   */
  keep(report: Report): Promise<boolean> {
    return this.inTurn(() => this.write(report))
  }

  private async write(report: Report): Promise<boolean> {
    let transaction: IDBTransaction | undefined
    try {
      transaction = this.database.transaction([draftStore, documentStore], 'readwrite')
      const store = transaction.objectStore(documentStore)
      /** The identifier of each content this transaction keeps, and refers to. */
      const chosen = new Map<Uint8Array, string>()
      /** Contents written by this transaction: their identifiers hold once it commits. */
      const written = new Map<Uint8Array, string>()
      for (const document of report.documents) {
        let identifier = this.identifiers.get(document.content) ?? chosen.get(document.content)
        if (identifier === undefined) {
          identifier = crypto.randomUUID()
          written.set(document.content, identifier)
          const record: DocumentRecord = {
            letter: document.kind.letter,
            fileName: document.fileName,
            content: document.content,
          }
          store.put(record, identifier)
        }
        chosen.set(document.content, identifier)
      }
      const kept = new Set(chosen.values())
      for (const key of await result(store.getAllKeys())) {
        if (typeof key !== 'string' || !kept.has(key)) store.delete(key)
      }
      transaction.objectStore(draftStore).put(recordOf(report, chosen), draftKey)
      await completed(transaction)
      for (const [content, identifier] of written) {
        this.identifiers.set(content, identifier)
      }
      return true
    } catch {
      abort(transaction)
      return false
    }
  }

  discard(): Promise<boolean> {
    return this.inTurn(() => this.clear())
  }

  private async clear(): Promise<boolean> {
    try {
      const transaction = this.database.transaction([draftStore, documentStore], 'readwrite')
      transaction.objectStore(draftStore).clear()
      transaction.objectStore(documentStore).clear()
      await completed(transaction)
      return true
    } catch {
      return false
    }
  }

  private documentOf(
    identifier: string,
    record: unknown,
    name: string | undefined,
  ): Document | undefined {
    if (typeof record !== 'object' || record === null) return undefined
    const { letter, fileName, content } = record as Record<string, unknown>
    const kind = Kind.all.find((each) => each.letter === letter)
    if (
      kind === undefined ||
      typeof fileName !== 'string' ||
      fileName.trim() === '' ||
      !(content instanceof Uint8Array)
    ) {
      return undefined
    }
    this.identifiers.set(content, identifier)
    return new Document(kind, fileName, content, name)
  }
}

/** What IndexedDB keeps of a report, its documents by the identifiers its transaction chose. */
function recordOf(
  report: Report,
  chosen: ReadonlyMap<Uint8Array, string>,
): Record<string, unknown> {
  const identifier = (document: Document) => chosen.get(document.content) ?? ''
  const expenses: ExpenseRecord[] = report.expenses.map((expense) => ({
    ...(expense.date === undefined ? {} : { date: expense.date.toString() }),
    ...(expense.description === undefined ? {} : { description: expense.description }),
    ...(expense.claimedAmount === undefined ? {} : { claimedAmount: expense.claimedAmount.cents }),
    isPaidInAnotherCurrency: expense.isPaidInAnotherCurrency,
    ...(expense.foreignAmount === undefined ? {} : { foreignAmount: expense.foreignAmount.cents }),
    ...(expense.currency === undefined ? {} : { currency: expense.currency.code }),
    receipts: expense.receipts.map(identifier),
    bankStatements: expense.bankStatements.map(identifier),
  }))
  const perDiems: PerDiemRecord[] = report.perDiems.map((perDiem) => ({
    date: perDiem.date.toString(),
    internationalMeals: perDiem.internationalMeals.map((meal) => meal.name),
    mealsClaimed: perDiem.mealsClaimed.map((meal) => meal.name),
    reasons: Object.fromEntries([...perDiem.reasons].map(([meal, reason]) => [meal.name, reason])),
  }))
  const names = Object.fromEntries(
    report.documents
      .filter((document) => document.name !== document.afterNaming('').name)
      .map((document) => [identifier(document), document.name]),
  )
  return {
    claimantName: report.claimantName,
    position: report.position,
    email: report.email,
    supervisorName: report.supervisorName,
    supervisorEmail: report.supervisorEmail,
    hostName: report.hostName,
    hostEmail: report.hostEmail,
    purpose: report.purpose,
    isBusinessTravel: report.isBusinessTravel,
    firstDay: report.firstDay?.toString(),
    lastDay: report.lastDay?.toString(),
    locations: report.locations,
    account: report.account,
    expenses,
    perDiems,
    travelJustifications: report.travelJustifications.map(identifier),
    additionalDocuments: report.additionalDocuments.map(identifier),
    names,
  }
}

/** The name of each document the Claimant named otherwise than its file, by its identifier. */
function namesOf(record: unknown): Map<string, string> {
  const names = (record as { names?: unknown } | undefined)?.names
  if (typeof names !== 'object' || names === null) return new Map()
  return new Map(
    Object.entries(names).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

/** The report a record holds, keeping only what follows the rules of each field. */
function reportOf(record: unknown, documents: ReadonlyMap<string, Document>): Report {
  if (typeof record !== 'object' || record === null) {
    return new Report()
  }
  const fields = record as Record<string, unknown>
  const documentsAmong = (value: unknown, kind: Kind) =>
    identifiers(value)
      .map((identifier) => documents.get(identifier))
      .filter((document) => document?.kind === kind)
      .filter((document) => document !== undefined)
  const expenses = (Array.isArray(fields.expenses) ? fields.expenses : []).map((value) => {
    const expense = (typeof value === 'object' && value !== null ? value : {}) as Record<
      string,
      unknown
    >
    return new Expense({
      date: date(expense.date),
      description: text(expense.description),
      claimedAmount: amountOf(expense.claimedAmount),
      isPaidInAnotherCurrency: expense.isPaidInAnotherCurrency === true,
      foreignAmount: amountOf(expense.foreignAmount),
      currency: typeof expense.currency === 'string' ? Currency.parse(expense.currency) : undefined,
      receipts: documentsAmong(expense.receipts, Kind.receipt),
      bankStatements: documentsAmong(expense.bankStatements, Kind.bankStatement),
    })
  })
  const isBusinessTravel = fields.isBusinessTravel === true
  const perDiems = (Array.isArray(fields.perDiems) ? fields.perDiems : []).flatMap(perDiemOf)
  return new Report({
    claimantName: text(fields.claimantName),
    position: positions.find((choice) => choice === fields.position),
    email: email(fields.email),
    supervisorName: text(fields.supervisorName),
    supervisorEmail: email(fields.supervisorEmail),
    hostName: text(fields.hostName),
    hostEmail: email(fields.hostEmail),
    purpose: text(fields.purpose),
    isBusinessTravel,
    firstDay: isBusinessTravel ? date(fields.firstDay) : undefined,
    lastDay: isBusinessTravel ? date(fields.lastDay) : undefined,
    locations: text(fields.locations),
    account: text(fields.account),
    expenses,
    perDiems,
    travelJustifications: documentsAmong(fields.travelJustifications, Kind.additionalDocument),
    additionalDocuments: documentsAmong(fields.additionalDocuments, Kind.additionalDocument),
  }).afterChanging({})
}

/**
 * The per diem a record holds, its international meals, its meals claimed and its reasons by the
 * meals' names, a reason kept only for a meal
 * not claimed; none when its date is not a calendar date.
 */
function perDiemOf(value: unknown): PerDiem[] {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >
  const day = date(record.date)
  if (day === undefined) return []
  const mealsOf = (value: unknown) => identifiers(value).flatMap((name) => Meal.named(name) ?? [])
  const mealsClaimed = mealsOf(record.mealsClaimed)
  const internationalMeals = mealsOf(record.internationalMeals)
  const given = typeof record.reasons === 'object' && record.reasons !== null ? record.reasons : {}
  const reasons = new Map(
    Object.entries(given).flatMap(([name, reason]) => {
      const meal = Meal.named(name)
      const kept = text(reason)
      return meal === undefined || kept === undefined || mealsClaimed.includes(meal)
        ? []
        : [[meal, kept] as const]
    }),
  )
  return [new PerDiem(day, { internationalMeals, mealsClaimed, reasons })]
}

/** The browser's IndexedDB, or nothing when the browser does not give access to it. */
function browserFactory(): IDBFactory | undefined {
  try {
    return globalThis.indexedDB
  } catch {
    return undefined
  }
}

/** Asks the browser to keep the draft through storage pressure, and goes on whatever the answer. */
async function askForPersistentStorage(): Promise<void> {
  try {
    await globalThis.navigator?.storage?.persist?.()
  } catch {
    // Best effort (ADR 0008): the draft is kept all the same, only less firmly.
  }
}

/**
 * The draft store, in the browser's IndexedDB unless another is given; a store that keeps nothing
 * when the browser refuses.
 */
export async function openDraftStore(
  factory: IDBFactory | undefined = browserFactory(),
): Promise<DraftStore> {
  if (factory === undefined) return nothingKept
  try {
    const database = await opened(factory)
    await askForPersistentStorage()
    return new IndexedDraftStore(database)
  } catch {
    return nothingKept
  }
}
