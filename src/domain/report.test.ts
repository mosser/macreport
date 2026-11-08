import { describe, expect, it } from 'vitest'
import { CalendarDate } from './calendar-date.ts'
import { Document } from './document.ts'
import { Expense } from './expense.ts'
import { Kind } from './kind.ts'
import { Meal } from './meal.ts'
import { MissingReceipt } from './missing-receipt.ts'
import { PerDiem } from './per-diem.ts'
import { positions, Report } from './report.ts'

describe('Report', () => {
  it('knows the missing receipt of the last expense added that has one', () => {
    const missing = (paidTo: string) =>
      new MissingReceipt({ reason: 'Lost', paidTo, jobTitle: 'PhD Student' })
    const first = new Expense({ missingReceipt: missing('Taxi'), description: 'Taxi' })
    const second = new Expense({ missingReceipt: missing('Bus') })
    expect(new Report().lastMissingReceipt).toBeUndefined()
    const stated = new Report().afterAdding(first).afterAdding(second).afterAdding(new Expense())
    expect(stated.lastMissingReceipt?.paidTo).toBe('Bus')
    expect(stated.afterRemovingExpense(second).lastMissingReceipt?.paidTo).toBe('Taxi')
  })

  it('starts empty', () => {
    const report = new Report()
    expect(report.claimantName).toBeUndefined()
    expect(report.expenses).toEqual([])
  })

  it('offers the five positions', () => {
    expect(positions).toEqual(['Faculty', 'Postdoctoral fellow', 'Student', 'Staff', 'Visitor'])
  })

  it('holds email addresses only', () => {
    expect(() => new Report({ email: 'not an email' })).toThrow(TypeError)
    expect(() => new Report({ supervisorEmail: 'nope' })).toThrow(TypeError)
    expect(() => new Report({ hostEmail: 'nope' })).toThrow(TypeError)
  })

  it('asks for a supervisor of a student or a postdoctoral fellow, and a host of a visitor', () => {
    expect(new Report({ position: 'Student' }).asksForSupervisor).toBe(true)
    expect(new Report({ position: 'Postdoctoral fellow' }).asksForSupervisor).toBe(true)
    expect(new Report({ position: 'Student' }).asksForHost).toBe(false)
    expect(new Report({ position: 'Visitor' }).asksForHost).toBe(true)
    expect(new Report({ position: 'Visitor' }).asksForSupervisor).toBe(false)
    for (const position of ['Faculty', 'Staff'] as const) {
      expect(new Report({ position }).asksForSupervisor).toBe(false)
      expect(new Report({ position }).asksForHost).toBe(false)
    }
  })

  it('takes the supervisor out when another position is chosen', () => {
    const student = new Report({ position: 'Student' }).afterChanging({
      supervisorName: 'Ada',
      supervisorEmail: 'ada@mcmaster.ca',
    })
    expect(student.afterChanging({ position: 'Student' }).supervisorName).toBe('Ada')
    expect(student.afterChanging({ purpose: 'ICSE' }).supervisorName).toBe('Ada')
    expect(student.afterChanging({ position: 'Postdoctoral fellow' }).supervisorName).toBe('Ada')
    const staff = student.afterChanging({ position: 'Staff' })
    expect(staff.supervisorName).toBeUndefined()
    expect(staff.supervisorEmail).toBeUndefined()
  })

  it('takes the host out when another position is chosen', () => {
    const visitor = new Report({ position: 'Visitor', hostName: 'Bo', hostEmail: 'bo@mcmaster.ca' })
    const student = visitor.afterChanging({ position: 'Student' })
    expect(student.hostName).toBeUndefined()
    expect(student.hostEmail).toBeUndefined()
  })

  it('takes the supervisor out when no position is chosen', () => {
    const student = new Report({ position: 'Student' }).afterChanging({ supervisorName: 'Ada' })
    expect(student.afterChanging({ position: undefined }).supervisorName).toBeUndefined()
  })

  it('dates only a business travel, and takes the dates out when it is unticked', () => {
    const first = new CalendarDate(2026, 10, 3)
    expect(new Report().isBusinessTravel).toBe(false)
    const travel = new Report().afterChanging({ isBusinessTravel: true, firstDay: first })
    expect(travel.firstDay).toBe(first)
    const unticked = travel.afterChanging({ isBusinessTravel: false })
    expect(unticked.firstDay).toBeUndefined()
    expect(unticked.lastDay).toBeUndefined()
    expect(new Report().afterChanging({ firstDay: first }).firstDay).toBeUndefined()
  })

  it('adds and replaces an expense', () => {
    const expense = new Expense({ description: 'Taxi' })
    const report = new Report().afterAdding(expense)
    expect(report.expenses).toEqual([expense])
    const replacement = expense.afterChanging({ description: 'Train' })
    expect(report.afterReplacing(expense, replacement).expenses).toEqual([replacement])
  })

  it('sorts its expenses by date, then in the order they were added, those without a date last', () => {
    const on = (day: number | undefined, description: string) =>
      new Expense({
        date: day === undefined ? undefined : new CalendarDate(2026, 10, day),
        description,
      })
    const report = [on(5, 'taxi'), on(undefined, 'undated'), on(3, 'flight'), on(5, 'dinner')]
      .reduce((built, expense) => built.afterAdding(expense), new Report())
      .afterAdding(on(undefined, 'later'))
    expect(report.expensesByDate.map((expense) => expense.description)).toEqual([
      'flight',
      'taxi',
      'dinner',
      'undated',
      'later',
    ])
  })

  it('removes an expense, and with it the documents no other expense refers to', () => {
    const visa = new Document(Kind.bankStatement, 'visa.pdf', new Uint8Array([1]))
    const taxi = new Document(Kind.receipt, 'taxi.pdf', new Uint8Array([2]))
    const train = new Document(Kind.receipt, 'train.pdf', new Uint8Array([3]))
    const first = new Expense({ receipts: [taxi], bankStatements: [visa] })
    const second = new Expense({ receipts: [train], bankStatements: [visa] })
    const report = new Report().afterAdding(first).afterAdding(second)
    expect(report.documentsOf(Kind.receipt)).toEqual([taxi, train])
    expect(report.documentsOf(Kind.bankStatement)).toEqual([visa])
    expect(report.documentsLeavingWith(first)).toEqual([taxi])
    const removed = report.afterRemovingExpense(first)
    expect(removed.expenses).toEqual([second])
    expect(removed.documents).toEqual([train, visa])
    expect(removed.documentsLeavingWith(second)).toEqual([train, visa])
    expect(removed.afterRemovingExpense(second).documents).toEqual([])
  })

  it('finds the document of the same kind and content as a file added again', () => {
    const visa = new Document(Kind.bankStatement, 'visa.pdf', new Uint8Array([1, 2]))
    const report = new Report().afterAdding(new Expense({ bankStatements: [visa] }))
    const again = new Document(Kind.bankStatement, 'copy.pdf', new Uint8Array([1, 2]))
    expect(report.documentLike(again)).toBe(visa)
    const asReceipt = new Document(Kind.receipt, 'visa.pdf', new Uint8Array([1, 2]))
    expect(report.documentLike(asReceipt)).toBeUndefined()
    const other = new Document(Kind.bankStatement, 'other.pdf', new Uint8Array([3]))
    expect(report.documentLike(other)).toBeUndefined()
  })

  it('keeps only the claimant, and their supervisor or host, for a new report', () => {
    const invitation = new Document(Kind.additionalDocument, 'invitation.pdf', new Uint8Array())
    const report = new Report({
      claimantName: 'Zoë Lefèvre',
      position: 'Student',
      email: 'zoe@mcmaster.ca',
      supervisorName: 'Ada Lovelace',
      supervisorEmail: 'ada@mcmaster.ca',
      purpose: 'ICSE 2026',
      isBusinessTravel: true,
      firstDay: new CalendarDate(2026, 10, 3),
      accountName: '20-123-456',
      travelJustifications: [invitation],
    }).afterAdding(new Expense({ description: 'Taxi' }))
    expect(report.afterNewReport()).toEqual(
      new Report({
        claimantName: 'Zoë Lefèvre',
        position: 'Student',
        email: 'zoe@mcmaster.ca',
        supervisorName: 'Ada Lovelace',
        supervisorEmail: 'ada@mcmaster.ca',
      }),
    )
    const visitor = report.afterChanging({
      position: 'Visitor',
      hostName: 'Alan Turing',
      hostEmail: 'alan@mcmaster.ca',
    })
    expect(visitor.afterNewReport().hostName).toBe('Alan Turing')
    expect(visitor.afterNewReport().hostEmail).toBe('alan@mcmaster.ca')
  })

  it('holds travel justifications and additional documents of their own kinds only', () => {
    const receipt = new Document(Kind.receipt, 'taxi.pdf', new Uint8Array())
    expect(() => new Report({ travelJustifications: [receipt] })).toThrow(TypeError)
    expect(() => new Report({ additionalDocuments: [receipt] })).toThrow(TypeError)
    expect(new Report().travelJustifications).toEqual([])
    expect(new Report().additionalDocuments).toEqual([])
  })

  it('justifies only a business travel, and takes the travel justifications out when it is unticked', () => {
    const invitation = new Document(Kind.additionalDocument, 'invitation.pdf', new Uint8Array())
    const travel = new Report({ isBusinessTravel: true }).afterChanging({
      travelJustifications: [invitation],
    })
    expect(travel.travelJustifications).toEqual([invitation])
    expect(travel.afterChanging({ isBusinessTravel: false }).travelJustifications).toEqual([])
    expect(
      new Report().afterChanging({ travelJustifications: [invitation] }).travelJustifications,
    ).toEqual([])
  })

  it('names a document otherwise wherever it is, and removes it from wherever it is', () => {
    const statement = new Document(Kind.bankStatement, 'scan.pdf', new Uint8Array())
    const invitation = new Document(Kind.additionalDocument, 'invitation.pdf', new Uint8Array())
    const poster = new Document(Kind.additionalDocument, 'poster.png', new Uint8Array())
    const report = new Report({
      isBusinessTravel: true,
      travelJustifications: [invitation],
      additionalDocuments: [poster],
    }).afterAdding(new Expense({ bankStatements: [statement] }))
    const named = report.afterRenaming(statement, 'Visa, October')
    expect(named.expenses[0]?.bankStatements.map((document) => document.name)).toEqual([
      'Visa, October',
    ])
    expect(named.travelJustifications).toEqual([invitation])
    const programme = named.afterRenaming(invitation, 'Programme').travelJustifications[0]
    expect(programme?.name).toBe('Programme')
    const removed = report.afterRemovingDocument(poster).afterRemovingDocument(statement)
    expect(removed.additionalDocuments).toEqual([])
    expect(removed.expenses[0]?.bankStatements).toEqual([])
    expect(removed.travelJustifications).toEqual([invitation])
  })

  it('lists its documents in the order of the steps, and finds a name a document before has, whatever its case', () => {
    const receipt = new Document(Kind.receipt, 'scan.pdf', new Uint8Array([1]), 'Hotel')
    const statement = new Document(Kind.bankStatement, 'visa.pdf', new Uint8Array([2]))
    const poster = new Document(Kind.additionalDocument, 'poster.png', new Uint8Array([3]), 'hotel')
    const report = new Report({ additionalDocuments: [poster] }).afterAdding(
      new Expense({ receipts: [receipt], bankStatements: [statement] }),
    )
    expect(report.documents).toEqual([receipt, statement, poster])
    expect(report.isNameTaken(receipt)).toBe(false)
    expect(report.isNameTaken(statement)).toBe(false)
    expect(report.isNameTaken(poster)).toBe(true)
    expect(report.isNameTaken(poster.afterNaming('Poster'))).toBe(false)
  })

  it('gives a name no document has, numbering it when it is taken', () => {
    const scan = (name: string) =>
      new Document(Kind.additionalDocument, 'scan.pdf', new Uint8Array(), name)
    const report = new Report({ additionalDocuments: [scan('Receipt'), scan('receipt (2)')] })
    expect(report.freeNameLike('Hotel')).toBe('Hotel')
    expect(report.freeNameLike('Receipt')).toBe('Receipt (3)')
  })

  it('puts an expense back as it was, its documents and their names, and nothing else', () => {
    const receipt = new Document(Kind.receipt, 'hotel.pdf', new Uint8Array([1]))
    const other = new Document(Kind.receipt, 'taxi.pdf', new Uint8Array([2]))
    const statement = new Document(Kind.bankStatement, 'visa.pdf', new Uint8Array([3]), 'Visa')
    const poster = new Document(Kind.additionalDocument, 'poster.png', new Uint8Array([4]))
    const before = new Expense({
      description: 'Hotel',
      receipts: [receipt],
      bankStatements: [statement],
    })
    const taxi = new Expense({ description: 'Taxi', bankStatements: [statement] })
    const report = new Report().afterAdding(before).afterAdding(taxi)
    const changed = report
      .afterReplacing(
        before,
        before.afterRemoving(receipt).afterChanging({ description: 'Motel', receipts: [other] }),
      )
      .afterRenaming(statement, 'Mastercard')
      .afterChanging({ additionalDocuments: [poster] })
    const opened = changed.expenses[0] ?? new Expense()
    const putBack = changed.afterPuttingBack(opened, before)
    expect(putBack.expenses.map((expense) => expense.description)).toEqual(['Hotel', 'Taxi'])
    expect(putBack.documents.map((document) => document.name)).toEqual(['hotel', 'Visa', 'poster'])
    expect(putBack.expenses[0]?.bankStatements[0]).toBe(putBack.expenses[1]?.bankStatements[0])
    expect(putBack.additionalDocuments).toEqual([poster])
    const added = report.afterAdding(new Expense({ receipts: [other] }))
    const fresh = added.expenses[2] ?? new Expense()
    expect(added.afterPuttingBack(fresh, undefined).expenses).toEqual(report.expenses)
    expect(added.afterPuttingBack(fresh, undefined).documents).toEqual(report.documents)
  })

  describe('per diems', () => {
    const october = (day: number) => new CalendarDate(2026, 10, day)
    const travel = new Report({
      isBusinessTravel: true,
      firstDay: october(3),
      lastDay: october(5),
      locations: 'Lyon, France',
    })
    const dinner = new PerDiem(october(4), { mealsClaimed: [Meal.dinner] })

    it('are asked of a business travel whose dates are given, the last not before the first', () => {
      expect(travel.asksForPerDiems).toBe(true)
      expect(travel.days.map(String)).toEqual(['2026-10-03', '2026-10-04', '2026-10-05'])
      expect(travel.afterChanging({ lastDay: october(3) }).days.map(String)).toEqual(['2026-10-03'])
      for (const report of [
        new Report(),
        travel.afterChanging({ lastDay: undefined }),
        travel.afterChanging({ lastDay: october(2) }),
      ]) {
        expect(report.asksForPerDiems).toBe(false)
        expect(report.days).toEqual([])
      }
    })

    it('give every day a per diem, as it starts until the Claimant changes it', () => {
      const changed = travel.afterChangingPerDiem(dinner)
      expect(changed.perDiems).toEqual([dinner])
      expect(changed.perDiemOn(october(4))).toBe(dinner)
      const [first, second, third] = changed.perDiemsByDay
      expect(first?.date).toEqual(october(3))
      expect(first?.hasMealClaimed).toBe(false)
      expect(second).toBe(dinner)
      expect(third?.isEveryMealDomestic).toBe(true)
      expect(changed.claimedPerDiems).toEqual([dinner])
      const again = changed.afterChangingPerDiem(dinner.afterClaiming(Meal.lunch, true))
      expect(again.perDiems.map((perDiem) => perDiem.mealsClaimed)).toEqual([
        [Meal.lunch, Meal.dinner],
      ])
    })

    it('are set all international, or all domestic, at once', () => {
      const international = travel
        .afterChangingPerDiem(dinner)
        .afterChangingEveryPerDiem({ internationalMeals: Meal.all })
      expect(
        international.perDiemsByDay.map((perDiem) => perDiem.isEveryMealInternational),
      ).toEqual([true, true, true])
      expect(international.perDiemOn(october(4)).mealsClaimed).toEqual([Meal.dinner])
      const domestic = international.afterChangingEveryPerDiem({ internationalMeals: [] })
      expect(domestic.perDiems.every((perDiem) => perDiem.isEveryMealDomestic)).toBe(true)
    })

    it('leave with the days no longer between the dates, and all of them with the business travel', () => {
      const claimed = travel
        .afterChangingPerDiem(new PerDiem(october(3), { mealsClaimed: [Meal.lunch] }))
        .afterChangingPerDiem(dinner)
      expect(claimed.afterChanging({ firstDay: october(4) }).perDiems).toEqual([dinner])
      expect(claimed.afterChanging({ lastDay: undefined }).perDiems).toHaveLength(2)
      const unticked = claimed.afterChanging({ isBusinessTravel: false })
      expect(unticked.perDiems).toEqual([])
      expect(unticked.locations).toBeUndefined()
      expect(new Report({ perDiems: [dinner] }).perDiems).toEqual([])
      expect(claimed.afterNewReport().perDiems).toEqual([])
    })
  })

  it('reduces a document wherever it is, and restores it', () => {
    const shared = new Document(Kind.receipt, 'scan.pdf', new Uint8Array([1]))
    const programme = new Document(Kind.additionalDocument, 'programme.pdf', new Uint8Array([2]))
    const report = new Report({
      expenses: [new Expense({ receipts: [shared] }), new Expense({ receipts: [shared] })],
      additionalDocuments: [programme],
    })
    const reduced = report.afterReducing(shared)
    expect(reduced.expenses.map((expense) => expense.receipts[0]?.isReduced)).toEqual([true, true])
    expect(reduced.additionalDocuments[0]?.isReduced).toBe(false)
    expect(reduced.documents).toHaveLength(2)
    const again = reduced.afterRestoring(reduced.documents[0] as Document)
    expect(again.documents[0]?.isReduced).toBe(false)
    expect(again.documents[0]?.content).toBe(shared.content)
  })
})
