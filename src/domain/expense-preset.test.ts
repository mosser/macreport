import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Amount } from './amount.ts'
import { CalendarDate } from './calendar-date.ts'
import { CalendarMonth } from './calendar-month.ts'
import { Currency } from './currency.ts'
import type { Expense } from './expense.ts'
import {
  ExpensePreset,
  ExpensePresets,
  expensePresets,
  type PresetValues,
} from './expense-preset.ts'
import { Report } from './report.ts'

const euro = Currency.parse('EUR')
if (euro === undefined) throw new TypeError('The euro is a currency')

function date(text: string): CalendarDate {
  const parsed = CalendarDate.parse(text)
  if (parsed === undefined) throw new TypeError(`${text} is not a date`)
  return parsed
}

function month(text: string): CalendarMonth {
  const parsed = CalendarMonth.parse(text)
  if (parsed === undefined) throw new TypeError(`${text} is not a month`)
  return parsed
}

function presetNamed(name: string): ExpensePreset {
  const preset = expensePresets.all.find((each) => each.name === name)
  if (preset === undefined) throw new TypeError(`No preset ${name}`)
  return preset
}

function values(given: Partial<PresetValues> = {}): PresetValues {
  return {
    texts: new Map(),
    dates: new Map(),
    months: new Map(),
    amounts: new Map(),
    foreignAmounts: new Map(),
    ...given,
  }
}

const otherReport = new Report()
const today = date('2030-01-01')
const businessTravel = new Report({
  isBusinessTravel: true,
  firstDay: date('2026-10-03'),
  lastDay: date('2026-10-07'),
})

/** A subscription of Overleaf, from the first day given to the end month given. */
function subscription(first = '2026-01-15', end = '2026-03', given: Partial<PresetValues> = {}) {
  return values({
    texts: new Map([['title', 'Overleaf']]),
    dates: new Map([['first', date(first)]]),
    months: new Map([['end', month(end)]]),
    ...given,
  })
}

const summary = (expenses: readonly Expense[] | undefined) =>
  expenses?.map((expense) => [expense.date?.toString(), expense.description])

describe('the presets of config/expense-presets.json', () => {
  it('are those the system reads', () => {
    const file = JSON.parse(readFileSync('config/expense-presets.json', 'utf8'))
    expect(ExpensePresets.from(file).all.map((preset) => preset.name)).toEqual(
      expensePresets.all.map((preset) => preset.name),
    )
  })

  it('offers Monthly subscription to a report that is not a business travel', () => {
    expect(expensePresets.offeredTo(otherReport).map((preset) => preset.name)).toEqual([
      'Monthly subscription',
    ])
  })

  it('offers the conference presets to a business travel whose dates are valid', () => {
    expect(expensePresets.offeredTo(businessTravel).map((preset) => preset.name)).toEqual([
      'Conference planning',
      'Travel to conference (Air)',
      'Travel to conference (Train)',
    ])
    const undated = new Report({ isBusinessTravel: true })
    expect(expensePresets.offeredTo(undated)).toEqual([])
  })

  it('adds the expenses of Conference planning, without dates', () => {
    const preset = presetNamed('Conference planning')
    expect(preset.parameters).toEqual([])
    expect(summary(preset.expensesFor(values(), businessTravel, today))).toEqual([
      [undefined, 'Registration'],
      [undefined, 'Transport'],
      [undefined, 'Accommodation'],
    ])
  })

  it('adds the expenses of Travel to conference (Air), without asking for anything', () => {
    const preset = presetNamed('Travel to conference (Air)')
    expect(preset.parameters).toEqual([])
    expect(summary(preset.expensesFor(values(), businessTravel, today))).toEqual([
      ['2026-10-03', 'Transport: home to airport'],
      ['2026-10-03', 'Transport: airport to hotel'],
      ['2026-10-07', 'Transport: hotel to airport'],
      ['2026-10-07', 'Transport: airport to home'],
    ])
  })

  it('adds the expenses of Travel to conference (Train), without asking for anything', () => {
    const preset = presetNamed('Travel to conference (Train)')
    expect(preset.parameters).toEqual([])
    expect(summary(preset.expensesFor(values(), businessTravel, today))).toEqual([
      ['2026-10-03', 'Transport: home to train station'],
      ['2026-10-03', 'Transport: train station to hotel'],
      ['2026-10-07', 'Transport: hotel to train station'],
      ['2026-10-07', 'Transport: train station to home'],
    ])
  })

  it('adds one expense per month of Monthly subscription, both ends included', () => {
    const preset = presetNamed('Monthly subscription')
    expect(summary(preset.expensesFor(subscription(), otherReport, today))).toEqual([
      ['2026-01-15', 'Overleaf - January 2026'],
      ['2026-02-15', 'Overleaf - February 2026'],
      ['2026-03-15', 'Overleaf - March 2026'],
    ])
  })

  it('adds one expense when the end month is the month of the first expense', () => {
    const preset = presetNamed('Monthly subscription')
    expect(
      summary(preset.expensesFor(subscription('2026-01-15', '2026-01'), otherReport, today)),
    ).toEqual([['2026-01-15', 'Overleaf - January 2026']])
  })

  it('falls on the last day of a shorter month, going back to the day after it', () => {
    const preset = presetNamed('Monthly subscription')
    expect(
      preset
        .expensesFor(subscription('2026-01-31', '2026-03'), otherReport, today)
        ?.map((expense) => expense.date?.toString()),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('crosses a year', () => {
    const preset = presetNamed('Monthly subscription')
    expect(
      preset
        .expensesFor(subscription('2026-12-01', '2027-01'), otherReport, today)
        ?.map((expense) => expense.description),
    ).toEqual(['Overleaf - December 2026', 'Overleaf - January 2027'])
  })

  it('leaves the amounts of Monthly subscription empty unless they are given', () => {
    const [expense] =
      presetNamed('Monthly subscription').expensesFor(subscription(), otherReport, today) ?? []
    expect(expense?.claimedAmount).toBeUndefined()
    expect(expense?.isPaidInAnotherCurrency).toBe(false)
  })

  it('gives each expense the claimed amount given', () => {
    const amount = Amount.parse('21')
    if (amount === undefined) throw new TypeError('21 is an amount')
    const expenses = presetNamed('Monthly subscription').expensesFor(
      subscription('2026-01-15', '2026-02', { amounts: new Map([['amount', amount]]) }),
      otherReport,
      today,
    )
    expect(expenses?.map((expense) => expense.claimedAmount?.typed)).toEqual(['21.00', '21.00'])
  })

  it('gives each expense the foreign amount and the currency given', () => {
    const amount = Amount.parse('19.50')
    const [expense] =
      presetNamed('Monthly subscription').expensesFor(
        subscription('2026-01-15', '2026-02', {
          foreignAmounts: new Map([['foreign', { currency: euro, amount }]]),
        }),
        otherReport,
        today,
      ) ?? []
    expect(expense?.isPaidInAnotherCurrency).toBe(true)
    expect(expense?.foreignAmountText).toBe('EUR 19.50')
  })

  it('gives each expense the currency alone, when the amount changes from month to month', () => {
    const [expense] =
      presetNamed('Monthly subscription').expensesFor(
        subscription('2026-01-15', '2026-02', {
          foreignAmounts: new Map([['foreign', { currency: euro, amount: undefined }]]),
        }),
        otherReport,
        today,
      ) ?? []
    expect(expense?.isPaidInAnotherCurrency).toBe(true)
    expect(expense?.currency).toBe(euro)
    expect(expense?.foreignAmount).toBeUndefined()
  })

  it('never gives a document, a missing receipt or a payment in cash', () => {
    for (const expense of presetNamed('Monthly subscription').expensesFor(
      subscription(),
      otherReport,
      today,
    ) ?? []) {
      expect(expense.documents).toEqual([])
      expect(expense.missingReceipt).toBeUndefined()
      expect(expense.isPaidInCash).toBe(false)
    }
  })

  it('works out nothing until every required parameter is given', () => {
    const preset = presetNamed('Monthly subscription')
    for (const missing of ['texts', 'dates', 'months'] as const) {
      expect(
        preset.expensesFor(
          subscription('2026-01-15', '2026-03', { [missing]: new Map() }),
          otherReport,
          today,
        ),
        missing,
      ).toBeUndefined()
    }
  })

  it('offers 36 months from the month of the first expense, none before it is given', () => {
    const preset = presetNamed('Monthly subscription')
    const end = preset.parameters.find((parameter) => parameter.id === 'end')
    if (end === undefined) throw new TypeError('Monthly subscription has an end month')
    expect(preset.monthsOffered(end, values(), today)).toEqual([])
    const months = preset.monthsOffered(end, subscription('2026-01-15'), today)
    expect(months).toHaveLength(36)
    expect(months[0]?.inFull).toBe('January 2026')
    expect(months[35]?.inFull).toBe('December 2028')
  })

  it('works out nothing for a month the list does not offer', () => {
    const preset = presetNamed('Monthly subscription')
    expect(
      preset.expensesFor(subscription('2026-03-15', '2026-02'), otherReport, today),
    ).toBeUndefined()
    expect(
      preset.expensesFor(subscription('2026-01-15', '2029-01'), otherReport, today),
    ).toBeUndefined()
  })
})

describe('Monthly subscription, as of a day', () => {
  const preset = presetNamed('Monthly subscription')
  const end = preset.parameters.find((parameter) => parameter.id === 'end')
  if (end === undefined) throw new TypeError('Monthly subscription has an end month')
  const november8 = date('2026-11-08')
  const lastOffered = (first: string, day: CalendarDate) =>
    preset.monthsOffered(end, subscription(first), day).at(-1)?.inFull

  it('offers no month whose expense would fall after today', () => {
    expect(lastOffered('2026-01-15', november8)).toBe('October 2026')
  })

  it('offers the month of today when its expense falls by today', () => {
    expect(lastOffered('2026-01-05', november8)).toBe('November 2026')
    expect(lastOffered('2026-01-08', november8)).toBe('November 2026')
  })

  it('counts a shorter month by its last day', () => {
    expect(lastOffered('2026-01-31', date('2026-02-28'))).toBe('February 2026')
    expect(lastOffered('2026-01-31', date('2026-02-27'))).toBe('January 2026')
  })

  it('still offers 36 months at most', () => {
    expect(preset.monthsOffered(end, subscription('2020-01-15'), november8)).toHaveLength(36)
  })

  it('works out nothing for a month after today', () => {
    expect(
      preset.expensesFor(subscription('2026-01-15', '2026-11'), otherReport, november8),
    ).toBeUndefined()
    expect(
      preset.expensesFor(subscription('2026-01-15', '2026-10'), otherReport, november8),
    ).toHaveLength(10)
  })

  it('offers nothing and works out nothing from a first expense after today', () => {
    const later = subscription('2026-11-09', '2026-11')
    expect(preset.monthsOffered(end, later, november8)).toEqual([])
    expect(preset.expensesFor(later, otherReport, november8)).toBeUndefined()
  })
})

describe('a preset, read from its configuration', () => {
  const title = { id: 'title', label: 'Title', type: 'text' }
  const first = { id: 'first', label: 'First', type: 'date' }
  const end = { id: 'end', label: 'End', type: 'month', startingFrom: 'first', atMost: 2 }
  const repeat = { every: 'month', from: 'first', until: 'end' }
  const repeating = {
    name: 'Repeating',
    offeredFor: 'otherReport',
    parameters: [first, end],
    expenses: [{ repeat, date: 'repetition', description: 'Each {month}' }],
  }
  const simple = { name: 'Simple', offeredFor: 'otherReport', expenses: [{ description: 'One' }] }

  it('takes a date parameter as the date of an expense', () => {
    const preset = ExpensePreset.from({
      ...simple,
      parameters: [first],
      expenses: [{ date: 'first', description: 'One' }],
    })
    expect(
      summary(
        preset.expensesFor(
          values({ dates: new Map([['first', date('2026-05-02')]]) }),
          otherReport,
          today,
        ),
      ),
    ).toEqual([['2026-05-02', 'One']])
  })

  it('takes a text several times in a description, as typed', () => {
    const preset = ExpensePreset.from({
      ...simple,
      parameters: [title],
      expenses: [{ description: '{title} and {title}' }],
    })
    const given = values({ texts: new Map([['title', 'A{month}$&']]) })
    expect(summary(preset.expensesFor(given, otherReport, today))).toEqual([
      [undefined, 'A{month}$& and A{month}$&'],
    ])
  })

  it('refuses anything but an object of known words', () => {
    for (const broken of [
      undefined,
      null,
      [],
      'preset',
      { ...simple, other: 1 },
      { ...simple, expenses: [{ description: 'One', dat: 'firstDay' }] },
      { ...simple, parameters: [{ ...title, kind: 'text' }] },
      { ...repeating, expenses: [{ ...repeating.expenses[0], repeat: { ...repeat, unit: 1 } }] },
    ]) {
      expect(() => ExpensePreset.from(broken), JSON.stringify(broken)).toThrow(TypeError)
    }
  })

  it('refuses a name, a label or a description that is no text', () => {
    for (const broken of [
      { ...simple, name: 1 },
      { ...simple, parameters: [{ ...title, label: 2 }], expenses: [{ description: '{title}' }] },
      { ...simple, expenses: [{ description: 3 }] },
    ]) {
      expect(() => ExpensePreset.from(broken), JSON.stringify(broken)).toThrow(TypeError)
    }
  })

  it('refuses a name or a description left empty', () => {
    for (const broken of [
      { ...simple, name: ' ' },
      { ...simple, expenses: [{ description: '' }] },
    ]) {
      expect(() => ExpensePreset.from(broken), JSON.stringify(broken)).toThrow(RangeError)
    }
  })

  it('is offered for a business travel or for another report, and nothing else', () => {
    expect(() => ExpensePreset.from({ ...simple, offeredFor: 'everyone' })).toThrow(RangeError)
  })

  it('holds a list of parameters and at least one expense', () => {
    expect(() => ExpensePreset.from({ ...simple, parameters: 'none' })).toThrow(TypeError)
    expect(() => ExpensePreset.from({ ...simple, expenses: [] })).toThrow(TypeError)
    expect(() => ExpensePreset.from({ ...simple, expenses: 'none' })).toThrow(TypeError)
  })

  it('refuses a parameter of an unknown type, or badly called', () => {
    for (const parameter of [
      { ...title, type: 'number' },
      { ...title, id: 'month' },
      { ...title, id: 'firstDay' },
      { ...title, id: 'with space' },
    ]) {
      expect(
        () =>
          ExpensePreset.from({
            ...simple,
            parameters: [parameter],
            expenses: [{ description: `{${parameter.id}}` }],
          }),
        JSON.stringify(parameter),
      ).toThrow(RangeError)
    }
  })

  it('lets only an amount be optional, and a foreign amount always is', () => {
    const parameterIn = (parameter: object, expense: object) =>
      ExpensePreset.from({ ...simple, parameters: [parameter], expenses: [expense] })
    expect(() => parameterIn({ ...title, isOptional: true }, { description: '{title}' })).toThrow(
      RangeError,
    )
    expect(() => parameterIn({ ...title, isOptional: 'yes' }, { description: '{title}' })).toThrow(
      TypeError,
    )
    const amount = { id: 'amount', label: 'Amount', type: 'amount' }
    const foreign = { id: 'foreign', label: 'Foreign', type: 'foreignAmount' }
    expect(() =>
      parameterIn({ ...foreign }, { description: 'One', foreignAmount: 'foreign' }),
    ).toThrow(RangeError)
    expect(
      parameterIn(
        { ...foreign, isOptional: true },
        { description: 'One', foreignAmount: 'foreign' },
      ).parameters[0]?.isOptional,
    ).toBe(true)
    expect(
      parameterIn({ ...amount, isOptional: true }, { description: 'One', claimedAmount: 'amount' })
        .parameters[0]?.isOptional,
    ).toBe(true)
  })

  it('makes a month name its start and the length of its list, and only a month', () => {
    for (const parameters of [
      [first, { ...end, startingFrom: undefined }],
      [first, { ...end, atMost: 0 }],
      [first, { ...end, atMost: 1.5 }],
      [first, { ...end, atMost: undefined }],
      [first, { ...end, startingFrom: 'nothing' }],
    ]) {
      expect(
        () => ExpensePreset.from({ ...repeating, parameters }),
        JSON.stringify(parameters),
      ).toThrow(RangeError)
    }
    for (const extra of [{ startingFrom: 'first' }, { atMost: 2 }]) {
      expect(
        () =>
          ExpensePreset.from({
            ...simple,
            parameters: [first, { ...title, ...extra }],
            expenses: [{ date: 'first', description: '{title}' }],
          }),
        JSON.stringify(extra),
      ).toThrow(RangeError)
    }
  })

  it('lets only a date or a month be not after today', () => {
    expect(() =>
      ExpensePreset.from({
        ...simple,
        parameters: [{ ...title, isNotAfterToday: true }],
        expenses: [{ description: '{title}' }],
      }),
    ).toThrow(RangeError)
    expect(() =>
      ExpensePreset.from({
        ...simple,
        parameters: [{ ...first, isNotAfterToday: 'yes' }],
        expenses: [{ date: 'first', description: 'One' }],
      }),
    ).toThrow(TypeError)
  })

  it('leaves a date free, and every month of the list, unless not after today', () => {
    const preset = ExpensePreset.from(repeating)
    const given = values({
      dates: new Map([['first', date('2031-05-02')]]),
      months: new Map([['end', month('2031-06')]]),
    })
    expect(preset.expensesFor(given, otherReport, today)).toHaveLength(2)
  })

  it('refuses two parameters of one id, or two presets of one name', () => {
    expect(() =>
      ExpensePreset.from({
        ...simple,
        parameters: [title, title],
        expenses: [{ description: '{title}' }],
      }),
    ).toThrow(RangeError)
    expect(() => ExpensePresets.from({ presets: [simple, simple] })).toThrow(RangeError)
  })

  it('refuses a parameter no expense uses', () => {
    expect(() => ExpensePreset.from({ ...simple, parameters: [title] })).toThrow(RangeError)
  })

  it('refuses a date that is neither a date parameter nor a day of the travel', () => {
    const withDate = (dated: string) =>
      ExpensePreset.from({ ...simple, expenses: [{ date: dated, description: 'One' }] })
    expect(() => withDate('tomorrow')).toThrow(RangeError)
    expect(() => withDate('firstDay')).toThrow(RangeError)
    expect(() => withDate('lastDay')).toThrow(RangeError)
    expect(() => withDate('repetition')).toThrow(RangeError)
  })

  it('takes firstDay and lastDay in a preset for a business travel', () => {
    const preset = ExpensePreset.from({
      ...simple,
      offeredFor: 'businessTravel',
      expenses: [
        { date: 'firstDay', description: 'There' },
        { date: 'lastDay', description: 'Back' },
      ],
    })
    expect(summary(preset.expensesFor(values(), businessTravel, today))).toEqual([
      ['2026-10-03', 'There'],
      ['2026-10-07', 'Back'],
    ])
  })

  it('refuses an amount naming a parameter of another type', () => {
    for (const expense of [
      { description: 'One', claimedAmount: 'first', date: 'first' },
      { description: 'One', foreignAmount: 'first', date: 'first' },
    ]) {
      expect(
        () => ExpensePreset.from({ ...simple, parameters: [first], expenses: [expense] }),
        JSON.stringify(expense),
      ).toThrow(RangeError)
    }
  })

  it('refuses a description naming what it cannot say', () => {
    for (const description of [
      '{title}',
      '{month}',
      '{year}',
      'Open { only',
      'Close } only',
      'Home → airport',
    ]) {
      expect(
        () => ExpensePreset.from({ ...simple, expenses: [{ description }] }),
        description,
      ).toThrow(RangeError)
    }
  })

  it('refuses a repetition that breaks its rule', () => {
    const withExpense = (expense: object) =>
      ExpensePreset.from({ ...repeating, expenses: [expense] })
    const description = 'Each {month}'
    for (const expense of [
      { repeat: { ...repeat, every: 'week' }, date: 'repetition', description },
      { repeat: { ...repeat, from: 'end' }, date: 'repetition', description },
      { repeat: { ...repeat, until: 'first' }, date: 'repetition', description },
      { repeat, date: 'first', description },
      { repeat, description },
      { date: 'repetition', description: 'Each' },
    ]) {
      expect(() => withExpense(expense), JSON.stringify(expense)).toThrow(RangeError)
    }
  })

  it('refuses a month that starts from another date than the repetition', () => {
    const other = { id: 'other', label: 'Other', type: 'date' }
    expect(() =>
      ExpensePreset.from({
        ...repeating,
        parameters: [first, other, { ...end, startingFrom: 'other' }],
      }),
    ).toThrow(RangeError)
  })
})

describe('the presets, read from their configuration', () => {
  it('hold a list of presets, which may be empty', () => {
    expect(ExpensePresets.from({ presets: [] }).all).toEqual([])
    for (const broken of [undefined, [], { presets: 'none' }, { other: [] }]) {
      expect(() => ExpensePresets.from(broken), JSON.stringify(broken)).toThrow(TypeError)
    }
  })
})
