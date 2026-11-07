import { type Claimant, positions } from '../domain/report.ts'
import { isEmailAddress, textOrAbsent } from '../domain/text.ts'

/**
 * Where the browser keeps what it remembers from one report to the next (ADR 0008). Keeping it is
 * best effort: when the browser refuses, nothing is remembered and everything else works.
 */
export interface ClaimantMemory {
  /** The claimant remembered, or nothing when there is none or the browser refuses. */
  recall(): Promise<Claimant>
  /** Remembers the claimant, as last entered; a field left empty is forgotten. */
  remember(claimant: Claimant): Promise<void>
}

const databaseName = 'macreport'
const storeName = 'claimant'
const key = 'claimant'

/** What IndexedDB keeps of the claimant: texts only. */
interface ClaimantRecord {
  readonly claimantName?: string
  readonly position?: string
  readonly email?: string
}

function opened(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction<T>(
  factory: IDBFactory,
  mode: IDBTransactionMode,
  act: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await opened(factory)
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = act(database.transaction(storeName, mode).objectStore(storeName))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    database.close()
  }
}

/** The claimant a record holds, keeping only what follows the rules of its fields. */
function claimantOf(record: unknown): Claimant {
  if (typeof record !== 'object' || record === null) {
    return {}
  }
  const { claimantName, position, email } = record as Record<string, unknown>
  const text = (value: unknown) => (typeof value === 'string' ? textOrAbsent(value) : undefined)
  const typedEmail = text(email)
  return {
    claimantName: text(claimantName),
    position: positions.find((choice) => choice === position),
    email: typedEmail !== undefined && isEmailAddress(typedEmail) ? typedEmail : undefined,
  }
}

function recordOf(claimant: Claimant): ClaimantRecord {
  return {
    ...(claimant.claimantName === undefined ? {} : { claimantName: claimant.claimantName }),
    ...(claimant.position === undefined ? {} : { position: claimant.position }),
    ...(claimant.email === undefined ? {} : { email: claimant.email }),
  }
}

/** The browser's IndexedDB, or nothing when the browser does not give access to it. */
function browserFactory(): IDBFactory | undefined {
  try {
    return globalThis.indexedDB
  } catch {
    return undefined
  }
}

/** The memory of the claimant, kept in IndexedDB; the browser's own unless another is given. */
export function claimantMemory(factory: IDBFactory | undefined = browserFactory()): ClaimantMemory {
  return {
    async recall() {
      if (factory === undefined) return {}
      try {
        return claimantOf(await transaction(factory, 'readonly', (store) => store.get(key)))
      } catch {
        return {}
      }
    },

    async remember(claimant) {
      if (factory === undefined) return
      try {
        await transaction(factory, 'readwrite', (store) => store.put(recordOf(claimant), key))
      } catch {
        // Best effort (ADR 0008): the claimant is then typed again next time.
      }
    },
  }
}
