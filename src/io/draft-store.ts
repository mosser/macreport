import { Amount } from '../domain/amount.ts'
import { CalendarDate } from '../domain/calendar-date.ts'
import { Document } from '../domain/document.ts'
import { Expense } from '../domain/expense.ts'
import { Kind } from '../domain/kind.ts'
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
  /** Deletes the draft and every document's content, for New report. */
  discard(): Promise<void>
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
  readonly receipts: readonly string[]
  readonly bankStatements: readonly string[]
}

/** What IndexedDB keeps of a document: its kind by its letter, its name and its bytes. */
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
      for (const name of [...database.objectStoreNames]) {
        database.deleteObjectStore(name)
      }
      database.createObjectStore(draftStore)
      database.createObjectStore(documentStore)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    // Another page holds an older draft open: rather than wait for it, keep nothing this time.
    request.onblocked = () => reject(new Error('The draft is held open by another page'))
  })
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** The documents of a report: the receipts and bank statements of its expenses, each once. */
function documentsOf(report: Report): Document[] {
  const documents = report.expenses.flatMap((expense) => [
    ...expense.receipts,
    ...expense.bankStatements,
  ])
  return [...new Set(documents)]
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
  discard: async () => {},
}

class IndexedDraftStore implements DraftStore {
  readonly isKept = true
  private readonly database: IDBDatabase
  /** The identifier of each document, given when it is first kept. */
  private readonly identifiers = new WeakMap<Document, string>()

  constructor(database: IDBDatabase) {
    this.database = database
  }

  async restore(): Promise<Report> {
    try {
      const transaction = this.database.transaction([draftStore, documentStore], 'readonly')
      const record = await result(transaction.objectStore(draftStore).get(draftKey))
      const documents = new Map<string, Document>()
      const store = transaction.objectStore(documentStore)
      const keys = (await result(store.getAllKeys())).filter((key) => typeof key === 'string')
      for (const key of keys) {
        const document = this.documentOf(key, await result(store.get(key)))
        if (document !== undefined) documents.set(key, document)
      }
      return reportOf(record, documents)
    } catch {
      return new Report()
    }
  }

  async keep(report: Report): Promise<boolean> {
    try {
      const transaction = this.database.transaction([draftStore, documentStore], 'readwrite')
      const store = transaction.objectStore(documentStore)
      const kept = new Set<string>()
      for (const document of documentsOf(report)) {
        let identifier = this.identifiers.get(document)
        if (identifier === undefined) {
          identifier = crypto.randomUUID()
          this.identifiers.set(document, identifier)
          const record: DocumentRecord = {
            letter: document.kind.letter,
            fileName: document.fileName,
            content: document.content,
          }
          store.put(record, identifier)
        }
        kept.add(identifier)
      }
      for (const key of await result(store.getAllKeys())) {
        if (typeof key !== 'string' || !kept.has(key)) store.delete(key)
      }
      transaction.objectStore(draftStore).put(this.recordOf(report), draftKey)
      await completed(transaction)
      return true
    } catch {
      return false
    }
  }

  async discard(): Promise<void> {
    try {
      const transaction = this.database.transaction([draftStore, documentStore], 'readwrite')
      transaction.objectStore(draftStore).clear()
      transaction.objectStore(documentStore).clear()
      await completed(transaction)
    } catch {
      // Best effort (ADR 0008): what the browser would not delete, it did not keep either.
    }
  }

  private documentOf(identifier: string, record: unknown): Document | undefined {
    if (typeof record !== 'object' || record === null) return undefined
    const { letter, fileName, content } = record as Record<string, unknown>
    const kind = Kind.all.find((each) => each.letter === letter)
    if (kind === undefined || typeof fileName !== 'string' || !(content instanceof Uint8Array)) {
      return undefined
    }
    const document = new Document(kind, fileName, content)
    this.identifiers.set(document, identifier)
    return document
  }

  private recordOf(report: Report): Record<string, unknown> {
    const identifier = (document: Document) => this.identifiers.get(document) ?? ''
    const expenses: ExpenseRecord[] = report.expenses.map((expense) => ({
      ...(expense.date === undefined ? {} : { date: expense.date.toString() }),
      ...(expense.description === undefined ? {} : { description: expense.description }),
      ...(expense.claimedAmount === undefined
        ? {}
        : { claimedAmount: expense.claimedAmount.cents }),
      receipts: expense.receipts.map(identifier),
      bankStatements: expense.bankStatements.map(identifier),
    }))
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
      account: report.account,
      expenses,
    }
  }
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
      receipts: documentsAmong(expense.receipts, Kind.receipt),
      bankStatements: documentsAmong(expense.bankStatements, Kind.bankStatement),
    })
  })
  const isBusinessTravel = fields.isBusinessTravel === true
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
    account: text(fields.account),
    expenses,
  }).afterChanging({})
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
