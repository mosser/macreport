import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { Amount } from '../domain/amount.ts'
import { CalendarDate } from '../domain/calendar-date.ts'
import { Currency } from '../domain/currency.ts'
import { Document } from '../domain/document.ts'
import { Expense } from '../domain/expense.ts'
import { Kind } from '../domain/kind.ts'
import { Meal } from '../domain/meal.ts'
import { PerDiem } from '../domain/per-diem.ts'
import { Report } from '../domain/report.ts'
import { openDraftStore } from './draft-store.ts'

const receipt = new Document(Kind.receipt, 'reçu.pdf', new Uint8Array([37, 80, 68, 70]))
const statement = new Document(Kind.bankStatement, 'october.png', new Uint8Array([137, 80]))

const report = new Report({
  claimantName: 'Zoë Lefèvre',
  position: 'Student',
  email: 'zoe@mcmaster.ca',
  supervisorName: 'Ada Lovelace',
  supervisorEmail: 'ada@mcmaster.ca',
  purpose: 'ICSE 2026',
  isBusinessTravel: true,
  firstDay: new CalendarDate(2026, 10, 3),
  lastDay: new CalendarDate(2026, 10, 7),
  accountName: '20-123-456',
}).afterAdding(
  new Expense({
    date: new CalendarDate(2026, 10, 3),
    description: 'Air Canada',
    claimedAmount: new Amount(101235),
    receipts: [receipt],
    bankStatements: [statement],
  }),
)

/** Writes a draft record as it is, as an older or damaged draft would be. */
async function written(factory: IDBFactory, draft: unknown, documents: Record<string, unknown>) {
  const store = await openDraftStore(factory)
  await store.discard()
  const database = await new Promise<IDBDatabase>((resolve) => {
    const request = factory.open('macreport', 2)
    request.onsuccess = () => resolve(request.result)
  })
  const transaction = database.transaction(['draft', 'documents'], 'readwrite')
  transaction.objectStore('draft').put(draft, 'report')
  for (const [key, value] of Object.entries(documents)) {
    transaction.objectStore('documents').put(value, key)
  }
  await new Promise((resolve) => {
    transaction.oncomplete = resolve
  })
  database.close()
}

describe('the draft store', () => {
  it('opens on an empty report when there is no draft', async () => {
    const store = await openDraftStore(new IDBFactory())
    expect(store.isKept).toBe(true)
    expect(await store.restore()).toEqual(new Report())
  })

  it('keeps every field, the expense and its documents, from one opening to the next', async () => {
    const factory = new IDBFactory()
    expect(await (await openDraftStore(factory)).keep(report)).toBe(true)
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.claimantName).toBe('Zoë Lefèvre')
    expect(restored.supervisorEmail).toBe('ada@mcmaster.ca')
    expect(restored.isBusinessTravel).toBe(true)
    expect(restored.lastDay?.toString()).toBe('2026-10-07')
    const expense = restored.expenses[0]
    expect(expense?.claimedAmount?.cents).toBe(101235)
    expect(expense?.receipts[0]?.fileName).toBe('reçu.pdf')
    expect([...(expense?.receipts[0]?.content ?? [])]).toEqual([37, 80, 68, 70])
    expect(expense?.bankStatements[0]?.kind).toBe(Kind.bankStatement)
  })

  it('keeps the travel justifications, the additional documents and the name of each document', async () => {
    const factory = new IDBFactory()
    const invitation = new Document(Kind.additionalDocument, 'invitation.pdf', new Uint8Array([3]))
    const poster = new Document(Kind.additionalDocument, 'poster.png', new Uint8Array([4]))
    const justified = report
      .afterChanging({ travelJustifications: [invitation], additionalDocuments: [poster] })
      .afterRenaming(statement, 'Visa, October')
      .afterRenaming(invitation, 'Invitation from ICSE')
    expect(await (await openDraftStore(factory)).keep(justified)).toBe(true)
    const restored = await (await openDraftStore(factory)).restore()
    expect(
      restored.travelJustifications.map((document) => [document.name, document.fileName]),
    ).toEqual([['Invitation from ICSE', 'invitation.pdf']])
    expect(restored.additionalDocuments.map((document) => [document.name, document.kind])).toEqual([
      ['poster', Kind.additionalDocument],
    ])
    expect(restored.expenses[0]?.bankStatements[0]?.name).toBe('Visa, October')
    expect(restored.expenses[0]?.receipts[0]?.name).toBe('reçu')
    expect(restored.documents.filter((document) => restored.isNameTaken(document))).toEqual([])
  })

  it('keeps the locations and the per diems, their international meals, their meals claimed and their reasons', async () => {
    const factory = new IDBFactory()
    const perDiem = new PerDiem(new CalendarDate(2026, 10, 4), {
      internationalMeals: [Meal.dinner],
      mealsClaimed: [Meal.dinner, Meal.breakfast],
      reasons: new Map([[Meal.lunch, 'provided by the conference']]),
    })
    const travelled = report
      .afterChanging({ locations: 'Rio de Janeiro, Brazil' })
      .afterChangingPerDiem(perDiem)
    expect(await (await openDraftStore(factory)).keep(travelled)).toBe(true)
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.locations).toBe('Rio de Janeiro, Brazil')
    expect(restored.perDiems).toEqual([perDiem])
  })

  it('keeps only the per diems that follow their rules from a damaged draft', async () => {
    const factory = new IDBFactory()
    await written(
      factory,
      {
        isBusinessTravel: true,
        firstDay: '2026-10-03',
        lastDay: '2026-10-07',
        perDiems: [
          'not a per diem',
          { date: '2026-10-31', mealsClaimed: ['lunch'] },
          { date: 'not a date', mealsClaimed: ['lunch'] },
          {
            date: '2026-10-04',
            internationalMeals: ['dinner', 'tea', 4],
            mealsClaimed: ['lunch', 'supper', 3],
            reasons: { lunch: 'kept?', dinner: '  ', breakfast: 'at the hotel', tea: 'no' },
          },
          { date: '2026-10-05', reasons: 'none' },
        ],
      },
      {},
    )
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.perDiems.map((perDiem) => perDiem.date.toString())).toEqual([
      '2026-10-04',
      '2026-10-05',
    ])
    const [damaged] = restored.perDiems
    expect(damaged?.internationalMeals).toEqual([Meal.dinner])
    expect(damaged?.mealsClaimed).toEqual([Meal.lunch])
    expect([...(damaged?.reasons ?? [])]).toEqual([[Meal.breakfast, 'at the hotel']])
  })

  it('keeps every document when a change is kept before the one before it has finished', async () => {
    const factory = new IDBFactory()
    const store = await openDraftStore(factory)
    const named = report.afterRenaming(statement, 'Visa, October')
    const renamed = named.afterRenaming(named.expenses[0]?.bankStatements[0] ?? statement, 'Visa')
    expect(await Promise.all([store.keep(report), store.keep(named), store.keep(renamed)])).toEqual(
      [true, true, true],
    )
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.expenses[0]?.receipts.map((document) => document.fileName)).toEqual([
      'reçu.pdf',
    ])
    expect(restored.expenses[0]?.bankStatements.map((document) => document.name)).toEqual(['Visa'])
    const [kept, discarded] = await Promise.all([store.keep(report), store.discard()])
    expect([kept, discarded]).toEqual([true, true])
    expect(await (await openDraftStore(factory)).restore()).toEqual(new Report())
  })

  it('keeps the content of a document once, however many times the Claimant names it', async () => {
    const factory = new IDBFactory()
    const store = await openDraftStore(factory)
    await store.keep(report)
    const keysOf = () =>
      new Promise<IDBValidKey[]>((resolve) => {
        const request = factory.open('macreport', 2)
        request.onsuccess = () => {
          const all = request.result.transaction('documents').objectStore('documents').getAllKeys()
          all.onsuccess = () => resolve(all.result)
        }
      })
    const before = await keysOf()
    let named = report
    for (const name of ['V', 'Vi', 'Visa']) {
      const current = named.expenses[0]?.bankStatements[0] ?? statement
      named = named.afterRenaming(current, name)
      expect(await store.keep(named)).toBe(true)
    }
    expect(await keysOf()).toEqual(before)
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.expenses[0]?.bankStatements[0]?.name).toBe('Visa')
    const reopened = await openDraftStore(factory)
    const again = await reopened.restore()
    expect(
      await reopened.keep(again.afterRenaming(again.expenses[0]?.receipts[0] ?? receipt, 'Hotel')),
    ).toBe(true)
    expect(await keysOf()).toEqual(before)
  })

  it('keeps several expenses, their foreign amounts, and a bank statement they share once', async () => {
    const factory = new IDBFactory()
    const taxi = new Expense({
      date: new CalendarDate(2026, 10, 5),
      description: 'Taxi',
      isPaidInAnotherCurrency: true,
      foreignAmount: new Amount(5500),
      currency: Currency.parse('EUR'),
      bankStatements: [statement],
    })
    const half = new Expense({ isPaidInAnotherCurrency: true, currency: Currency.parse('JPY') })
    await (await openDraftStore(factory)).keep(report.afterAdding(taxi).afterAdding(half))
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.expenses.map((expense) => expense.foreignAmountText)).toEqual([
      '',
      'EUR 55.00',
      '',
    ])
    expect(restored.expenses.map((expense) => expense.isPaidInAnotherCurrency)).toEqual([
      false,
      true,
      true,
    ])
    expect(restored.expenses[1]?.claimedAmount).toBeUndefined()
    expect(restored.expenses[2]?.currency?.code).toBe('JPY')
    expect(restored.expenses[1]?.bankStatements[0]).toBe(restored.expenses[0]?.bankStatements[0])
    expect(restored.documents).toHaveLength(2)
  })

  it('keeps a report half-done, and deletes a document no expense refers to any more', async () => {
    const factory = new IDBFactory()
    const store = await openDraftStore(factory)
    await store.keep(report)
    const expense = report.expenses[0] ?? new Expense()
    const replaced = new Document(Kind.receipt, 'new.pdf', new Uint8Array([1]))
    const halfDone = report
      .afterChanging({ accountName: undefined })
      .afterReplacing(expense, expense.afterChanging({ receipts: [replaced], date: undefined }))
    await store.keep(halfDone)
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.accountName).toBeUndefined()
    expect(restored.expenses[0]?.date).toBeUndefined()
    expect(restored.expenses[0]?.receipts.map((document) => document.fileName)).toEqual(['new.pdf'])
    const keys = await new Promise<IDBValidKey[]>((resolve) => {
      const request = factory.open('macreport', 2)
      request.onsuccess = () => {
        const all = request.result.transaction('documents').objectStore('documents').getAllKeys()
        all.onsuccess = () => resolve(all.result)
      }
    })
    expect(keys).toHaveLength(2)
  })

  it('deletes the draft and its documents for New report', async () => {
    const factory = new IDBFactory()
    const store = await openDraftStore(factory)
    await store.keep(report)
    expect(await store.discard()).toBe(true)
    expect(await (await openDraftStore(factory)).restore()).toEqual(new Report())
  })

  it("keeps the account's name and code, and reads a 0.2.0 draft's account as its name", async () => {
    const factory = new IDBFactory()
    const coded = report.afterChanging({ accountName: 'NSERC Discovery', accountCode: '20-123' })
    expect(await (await openDraftStore(factory)).keep(coded)).toBe(true)
    const restored = await (await openDraftStore(factory)).restore()
    expect([restored.accountName, restored.accountCode]).toEqual(['NSERC Discovery', '20-123'])
    await written(factory, { account: ' 20-123-456 ' }, {})
    const older = await (await openDraftStore(factory)).restore()
    expect([older.accountName, older.accountCode]).toEqual(['20-123-456', undefined])
  })

  it('writes again a document taken out of the draft, then put back as it was', async () => {
    const factory = new IDBFactory()
    const store = await openDraftStore(factory)
    const expense = report.expenses[0] ?? new Expense()
    expect(await store.keep(report)).toBe(true)
    expect(await store.keep(report.afterRemovingExpense(expense))).toBe(true)
    expect(await store.keep(report)).toBe(true)
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.expenses[0]?.receipts.map((document) => document.fileName)).toEqual([
      'reçu.pdf',
    ])
    expect(restored.expenses[0]?.bankStatements.map((document) => document.fileName)).toEqual([
      'october.png',
    ])
  })

  it('keeps all of a report or nothing, and writes again a document a failed write left out', async () => {
    const factory = new IDBFactory()
    const store = await openDraftStore(factory)
    const unwritable = new Document(Kind.bankStatement, 'broken.pdf', {
      toString: () => 'not bytes',
      method: () => undefined,
    } as unknown as Uint8Array)
    const expense = report.expenses[0] ?? new Expense()
    const broken = report.afterReplacing(
      expense,
      expense.afterChanging({ bankStatements: [unwritable] }),
    )
    expect(await store.keep(broken)).toBe(false)
    expect(await (await openDraftStore(factory)).restore()).toEqual(new Report())
    expect(await store.keep(report)).toBe(true)
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.expenses[0]?.receipts.map((document) => document.fileName)).toEqual([
      'reçu.pdf',
    ])
  })

  it('keeps only what follows the rules of each field from a damaged draft', async () => {
    const factory = new IDBFactory()
    await written(
      factory,
      {
        claimantName: '  ',
        position: 'Dean',
        email: 'not an email',
        isBusinessTravel: false,
        firstDay: '2026-10-03',
        names: { a: 42, b: 'Statement' },
        travelJustifications: ['a', 'missing'],
        expenses: [
          { claimedAmount: -3, receipts: ['a', 'b', 'e', 'missing'], bankStatements: 'b' },
          'not an expense',
          { isPaidInAnotherCurrency: 'yes', foreignAmount: 5500, currency: 'EUR' },
          { isPaidInAnotherCurrency: true, foreignAmount: 1.5, currency: 'CAD' },
        ],
      },
      {
        a: { letter: 'R', fileName: 'a.pdf', content: new Uint8Array([1]) },
        e: { letter: 'R', fileName: ' ', content: new Uint8Array([5]) },
        b: { letter: 'S', fileName: 'b.pdf', content: new Uint8Array([2]) },
        c: { letter: 'X', fileName: 'c.pdf', content: new Uint8Array([3]) },
        d: 'not a document',
      },
    )
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.claimantName).toBeUndefined()
    expect(restored.position).toBeUndefined()
    expect(restored.email).toBeUndefined()
    expect(restored.firstDay).toBeUndefined()
    expect(restored.expenses).toHaveLength(4)
    expect(restored.expenses[2]?.isPaidInAnotherCurrency).toBe(false)
    expect(restored.expenses[2]?.foreignAmount).toBeUndefined()
    expect(restored.expenses[2]?.currency).toBeUndefined()
    expect(restored.expenses[3]?.isPaidInAnotherCurrency).toBe(true)
    expect(restored.expenses[3]?.foreignAmount).toBeUndefined()
    expect(restored.expenses[3]?.currency).toBeUndefined()
    expect(restored.expenses[0]?.claimedAmount).toBeUndefined()
    expect(restored.expenses[0]?.receipts.map((document) => document.fileName)).toEqual(['a.pdf'])
    expect(restored.expenses[0]?.receipts[0]?.name).toBe('a')
    expect(restored.expenses[0]?.bankStatements).toEqual([])
    expect(restored.travelJustifications).toEqual([])
    expect(restored.additionalDocuments).toEqual([])
    await written(factory, 'not a report', {})
    expect(await (await openDraftStore(factory)).restore()).toEqual(new Report())
  })

  it('works without the browser keeping anything, or when it refuses', async () => {
    for (const factory of [
      undefined,
      {
        open: () => {
          throw new Error('The browser refuses')
        },
      } as unknown as IDBFactory,
    ]) {
      const store = await openDraftStore(factory)
      expect(store.isKept).toBe(false)
      expect(await store.keep(report)).toBe(false)
      expect(await store.discard()).toBe(true)
      expect(await store.restore()).toEqual(new Report())
    }
  })

  it('says so when the browser stops keeping the draft', async () => {
    const factory = new IDBFactory()
    const store = await openDraftStore(factory)
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open('macreport', 2)
      request.onsuccess = () => resolve(request.result)
    })
    database.close()
    ;(store as unknown as { database: IDBDatabase }).database.close()
    expect(await store.keep(report)).toBe(false)
    expect(await store.restore()).toEqual(new Report())
    expect(await store.discard()).toBe(false)
  })

  it("uses the browser's own storage when given none", async () => {
    expect((await openDraftStore()).isKept).toBe(false)
  })
})

describe('the draft store, when another page holds an older draft open', () => {
  it('keeps nothing rather than wait', async () => {
    const factory = new IDBFactory()
    const older = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open('macreport', 1)
      request.onsuccess = () => resolve(request.result)
    })
    const store = await openDraftStore(factory)
    expect(store.isKept).toBe(false)
    older.close()
  })

  it('keeps that a document is reduced, and the file added rather than what reducing gives', async () => {
    const factory = new IDBFactory()
    const store = await openDraftStore(factory)
    await store.keep(report.afterReducing(statement))
    const restored = await (await openDraftStore(factory)).restore()
    const kept = restored.documentsOf(Kind.bankStatement)[0]
    expect(kept?.isReduced).toBe(true)
    expect([...(kept?.content ?? [])]).toEqual([...statement.content])
    expect(restored.documentsOf(Kind.receipt)[0]?.isReduced).toBe(false)
  })

  it('keeps that a document is restored', async () => {
    const factory = new IDBFactory()
    const store = await openDraftStore(factory)
    const reduced = report.afterReducing(statement)
    await store.keep(reduced)
    const again = reduced.documentsOf(Kind.bankStatement)[0] ?? statement
    await store.keep(reduced.afterRestoring(again))
    const restored = await (await openDraftStore(factory)).restore()
    expect(restored.documentsOf(Kind.bankStatement)[0]?.isReduced).toBe(false)
  })
})
