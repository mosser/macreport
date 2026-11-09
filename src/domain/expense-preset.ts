import configured from '../../config/expense-presets.json' with { type: 'json' }
import type { Amount } from './amount.ts'
import type { CalendarDate } from './calendar-date.ts'
import { CalendarMonth } from './calendar-month.ts'
import type { Currency } from './currency.ts'
import { Expense } from './expense.ts'
import type { Report } from './report.ts'
import { charactersNotWritableIn } from './writable-characters.ts'

const parameterTypes = ['text', 'date', 'month', 'amount', 'foreignAmount'] as const

/** What a preset parameter asks of the Claimant. */
export type ParameterType = (typeof parameterTypes)[number]

/** The words of the file that a preset parameter cannot be called. */
const reservedWords: ReadonlySet<string> = new Set([
  'firstDay',
  'lastDay',
  'repetition',
  'month',
  'year',
])

const placeholder = /\{([^{}]*)\}/g

/** What an expense preset asks of the Claimant before adding its expenses. */
export interface PresetParameter {
  /** What the file calls it. */
  readonly id: string
  /** What the dialog calls it. */
  readonly label: string
  readonly type: ParameterType
  readonly isOptional: boolean
  /** The date parameter whose month a month parameter's list starts from. */
  readonly startingFrom: string | undefined
  /** How many months a month parameter's list holds. */
  readonly atMost: number | undefined
  /** Whether a date, or the expense of a month, cannot fall after today. */
  readonly isNotAfterToday: boolean
}

/** A foreign amount given: its currency, and its amount when the Claimant knows it. */
export interface ForeignValue {
  readonly currency: Currency
  readonly amount: Amount | undefined
}

/** What the Claimant gave for the preset parameters, by type and by their ids. */
export interface PresetValues {
  readonly texts: ReadonlyMap<string, string>
  readonly dates: ReadonlyMap<string, CalendarDate>
  readonly months: ReadonlyMap<string, CalendarMonth>
  readonly amounts: ReadonlyMap<string, Amount>
  readonly foreignAmounts: ReadonlyMap<string, ForeignValue>
}

/** An expense as a preset says it: a repeating one stands for one expense per month. */
interface PresetExpense {
  readonly description: string
  readonly date: string | undefined
  readonly claimedAmount: string | undefined
  readonly foreignAmount: string | undefined
  readonly repeat: { readonly from: string; readonly until: string } | undefined
}

function fieldsOf(
  value: unknown,
  subject: string,
  words: readonly string[],
): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${subject} is not an object`)
  }
  const unknownWords = Object.keys(value).filter((word) => !words.includes(word))
  if (unknownWords.length > 0) {
    throw new TypeError(`${subject} holds an unknown word: ${unknownWords.join(', ')}`)
  }
  return value as Readonly<Record<string, unknown>>
}

function textOf(value: unknown, subject: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${subject} is not a text`)
  }
  if (value.trim() === '') {
    throw new RangeError(`${subject} is empty`)
  }
  return value
}

function optionalTextOf(value: unknown, subject: string): string | undefined {
  return value === undefined ? undefined : textOf(value, subject)
}

function isParameterType(value: unknown): value is ParameterType {
  return parameterTypes.includes(value as ParameterType)
}

function parameterOf(value: unknown): PresetParameter {
  const { id, label, type, isOptional, startingFrom, atMost, isNotAfterToday } = fieldsOf(
    value,
    'A preset parameter',
    ['id', 'label', 'type', 'isOptional', 'startingFrom', 'atMost', 'isNotAfterToday'],
  )
  const parameterId = textOf(id, 'The id of a preset parameter')
  const subject = `Preset parameter ${parameterId}`
  if (reservedWords.has(parameterId) || !/^\w+$/.test(parameterId)) {
    throw new RangeError(`${subject} cannot be called so`)
  }
  if (!isParameterType(type)) {
    throw new RangeError(`${subject} is of an unknown type`)
  }
  if (isOptional !== undefined && typeof isOptional !== 'boolean') {
    throw new TypeError(`${subject} says isOptional with something else than a boolean`)
  }
  if (isNotAfterToday !== undefined && typeof isNotAfterToday !== 'boolean') {
    throw new TypeError(`${subject} says isNotAfterToday with something else than a boolean`)
  }
  if (isNotAfterToday === true && type !== 'date' && type !== 'month') {
    throw new RangeError(`${subject} cannot be not after today: only a date or a month can`)
  }
  checkOptional(subject, type, isOptional === true)
  checkMonth(subject, type, startingFrom, atMost)
  return {
    id: parameterId,
    label: textOf(label, `The label of ${subject}`),
    type,
    isOptional: isOptional === true,
    startingFrom: optionalTextOf(startingFrom, `What ${subject} starts from`),
    atMost: atMost as number | undefined,
    isNotAfterToday: isNotAfterToday === true,
  }
}

/** Only an amount may be optional, and a foreign amount always is: it stands behind a tick box. */
function checkOptional(subject: string, type: ParameterType, isOptional: boolean): void {
  if (isOptional && type !== 'amount' && type !== 'foreignAmount') {
    throw new RangeError(`${subject} cannot be optional: only an amount can`)
  }
  if (!isOptional && type === 'foreignAmount') {
    throw new RangeError(`${subject} is optional, as every foreign amount`)
  }
}

/** A month says where its list starts from and how long it is; nothing else does. */
function checkMonth(
  subject: string,
  type: ParameterType,
  startingFrom: unknown,
  atMost: unknown,
): void {
  if (type !== 'month') {
    if (startingFrom !== undefined || atMost !== undefined) {
      throw new RangeError(`${subject} is not a month: it has no list`)
    }
    return
  }
  if (startingFrom === undefined) {
    throw new RangeError(`${subject} names the date its list starts from`)
  }
  if (typeof atMost !== 'number' || !Number.isInteger(atMost) || atMost < 1) {
    throw new RangeError(`${subject} says how many months its list holds`)
  }
}

/** The parameters of a preset by their ids, and each named by what the preset says of it. */
class PresetWords {
  private readonly parameters: ReadonlyMap<string, PresetParameter>
  private readonly subject: string
  private readonly isForBusinessTravel: boolean

  constructor(
    parameters: readonly PresetParameter[],
    subject: string,
    isForBusinessTravel: boolean,
  ) {
    this.parameters = new Map(parameters.map((parameter) => [parameter.id, parameter]))
    this.subject = subject
    this.isForBusinessTravel = isForBusinessTravel
    if (this.parameters.size < parameters.length) {
      throw new RangeError(`${subject} has two parameters of one id`)
    }
    for (const parameter of parameters) {
      if (parameter.startingFrom !== undefined) this.named(parameter.startingFrom, 'date')
    }
  }

  /** The id given, when it names a parameter of that type; throws a RangeError otherwise. */
  named(id: unknown, type: ParameterType): string {
    const parameterId = textOf(id, `What ${this.subject} names`)
    if (this.parameters.get(parameterId)?.type !== type) {
      throw new RangeError(`${this.subject} has no ${type} parameter ${parameterId}`)
    }
    return parameterId
  }

  /** The date of an expense: a date parameter, a day of the travel, or the repetition. */
  date(value: unknown, isRepeating: boolean): string | undefined {
    if (value === undefined && !isRepeating) return undefined
    if (isRepeating !== (value === 'repetition')) {
      throw new RangeError(
        `In ${this.subject}, a repeating expense, and only one, is on repetition`,
      )
    }
    if (value === 'repetition') return value
    if (value === 'firstDay' || value === 'lastDay') {
      if (!this.isForBusinessTravel) {
        throw new RangeError(`${this.subject} is not for a business travel: it has no ${value}`)
      }
      return value
    }
    return this.named(value, 'date')
  }

  /** The description of an expense, each placeholder a text or, when repeating, month and year. */
  description(value: unknown, isRepeating: boolean): string {
    const description = textOf(value, `A description of ${this.subject}`)
    for (const [, word] of description.matchAll(placeholder)) {
      if (!(isRepeating && (word === 'month' || word === 'year'))) this.named(word, 'text')
    }
    const words = description.replaceAll(placeholder, '')
    const notWritable = charactersNotWritableIn(words)
    if (words.includes('{') || words.includes('}') || notWritable.length > 0) {
      throw new RangeError(`${this.subject} says what the report document cannot write: ${words}`)
    }
    return description
  }

  /** The repetition of an expense: until a month whose list starts from the date it starts from. */
  repeat(value: unknown): PresetExpense['repeat'] {
    if (value === undefined) return undefined
    const { every, from, until } = fieldsOf(value, `A repetition of ${this.subject}`, [
      'every',
      'from',
      'until',
    ])
    if (every !== 'month') {
      throw new RangeError(`${this.subject} repeats every month, and nothing else`)
    }
    const first = this.named(from, 'date')
    const last = this.named(until, 'month')
    if (this.parameters.get(last)?.startingFrom !== first) {
      throw new RangeError(`In ${this.subject}, ${last} does not start from ${first}`)
    }
    return { from: first, until: last }
  }
}

function expenseOf(value: unknown, words: PresetWords, subject: string): PresetExpense {
  const { description, date, claimedAmount, foreignAmount, repeat } = fieldsOf(
    value,
    `An expense of ${subject}`,
    ['description', 'date', 'claimedAmount', 'foreignAmount', 'repeat'],
  )
  const repetition = words.repeat(repeat)
  const isRepeating = repetition !== undefined
  return {
    description: words.description(description, isRepeating),
    date: words.date(date, isRepeating),
    claimedAmount: claimedAmount === undefined ? undefined : words.named(claimedAmount, 'amount'),
    foreignAmount:
      foreignAmount === undefined ? undefined : words.named(foreignAmount, 'foreignAmount'),
    repeat: repetition,
  }
}

/** The ids of the parameters an expense of a preset uses. */
function parametersUsedBy(expense: PresetExpense): readonly (string | undefined)[] {
  return [
    expense.date,
    expense.claimedAmount,
    expense.foreignAmount,
    expense.repeat?.from,
    expense.repeat?.until,
    ...[...expense.description.matchAll(placeholder)].map(([, word]) => word),
  ]
}

function isGiven(parameter: PresetParameter, values: PresetValues): boolean {
  const given = {
    text: values.texts,
    date: values.dates,
    month: values.months,
    amount: values.amounts,
    foreignAmount: values.foreignAmounts,
  }
  return given[parameter.type].has(parameter.id)
}

/** Whether a date parameter holds what it may: a date not after today, when it cannot be. */
function isDateAllowed(
  parameter: PresetParameter,
  values: PresetValues,
  today: CalendarDate,
): boolean {
  const date = parameter.type === 'date' ? values.dates.get(parameter.id) : undefined
  return !parameter.isNotAfterToday || date === undefined || !today.isBefore(date)
}

/**
 * Expenses the system adds to a report together, as `config/expense-presets.json` configures them,
 * offered to a business travel or to another report. An expense added from a preset is like any
 * other and keeps no trace of it. A preset gives no document, and says nothing of how an expense
 * was paid.
 */
export class ExpensePreset {
  readonly name: string
  readonly isForBusinessTravel: boolean
  /** Whether it is not offered to a report holding an expense added from it. */
  readonly isOncePerReport: boolean
  readonly parameters: readonly PresetParameter[]
  private readonly expenses: readonly PresetExpense[]

  private constructor(
    name: string,
    isForBusinessTravel: boolean,
    isOncePerReport: boolean,
    parameters: readonly PresetParameter[],
    expenses: readonly PresetExpense[],
  ) {
    this.name = name
    this.isForBusinessTravel = isForBusinessTravel
    this.isOncePerReport = isOncePerReport
    this.parameters = parameters
    this.expenses = expenses
  }

  /**
   * The preset a configuration gives. Throws a TypeError when it holds anything but the words of
   * the file; a RangeError when a word breaks its rule, or a parameter is used by no expense.
   */
  static from(configuration: unknown): ExpensePreset {
    const { name, offeredFor, isOncePerReport, parameters, expenses } = fieldsOf(
      configuration,
      'An expense preset',
      ['name', 'offeredFor', 'isOncePerReport', 'parameters', 'expenses'],
    )
    const presetName = textOf(name, 'The name of an expense preset')
    const subject = `Expense preset ${presetName}`
    if (offeredFor !== 'businessTravel' && offeredFor !== 'otherReport') {
      throw new RangeError(`${subject} is offered for neither businessTravel nor otherReport`)
    }
    if (isOncePerReport !== undefined && typeof isOncePerReport !== 'boolean') {
      throw new TypeError(`${subject} says isOncePerReport with something else than a boolean`)
    }
    if (parameters !== undefined && !Array.isArray(parameters)) {
      throw new TypeError(`The parameters of ${subject} are not a list`)
    }
    if (!Array.isArray(expenses) || expenses.length === 0) {
      throw new TypeError(`${subject} adds at least one expense`)
    }
    const presetParameters = (parameters ?? []).map(parameterOf)
    const isForBusinessTravel = offeredFor === 'businessTravel'
    const words = new PresetWords(presetParameters, subject, isForBusinessTravel)
    const presetExpenses = expenses.map((expense) => expenseOf(expense, words, subject))
    const used = new Set(presetExpenses.flatMap(parametersUsedBy))
    for (const parameter of presetParameters) {
      if (!used.has(parameter.id)) {
        throw new RangeError(`${subject} uses its parameter ${parameter.id} in no expense`)
      }
    }
    return new ExpensePreset(
      presetName,
      isForBusinessTravel,
      isOncePerReport === true,
      presetParameters,
      presetExpenses,
    )
  }

  /**
   * Whether the preset is offered to a report: a preset for a business travel once the dates of the
   * travel are valid, a preset for another report when the report is not a business travel. A
   * preset once per report is not offered while the report holds an expense added from it.
   */
  isOfferedTo(report: Report): boolean {
    const isOfItsKind = this.isForBusinessTravel ? report.asksForPerDiems : !report.isBusinessTravel
    return isOfItsKind && !(this.isOncePerReport && this.isHeldBy(report))
  }

  private isHeldBy(report: Report): boolean {
    return report.expenses.some((expense) => expense.presetName === this.name)
  }

  /**
   * The months a month parameter offers: from the month of the date it starts from, as many as the
   * preset sets; none until that date is given. A month not after today is offered only when its
   * expense, on the day of that date, does not fall after today.
   */
  monthsOffered(
    parameter: PresetParameter,
    values: PresetValues,
    today: CalendarDate,
  ): readonly CalendarMonth[] {
    const start = values.dates.get(parameter.startingFrom ?? '')
    if (start === undefined) return []
    const months = CalendarMonth.of(start).andFollowing(parameter.atMost ?? 0)
    return parameter.isNotAfterToday
      ? months.filter((month) => !today.isBefore(month.dateOn(start.day)))
      : months
  }

  /**
   * The expenses the preset adds to a report, in order, each with what the preset says of it and
   * the name of the preset, and nothing else; none to work out until every required parameter is given, a date is not after
   * today when it cannot be, and a month chosen is one the list offers. A repeating expense stands for one expense per month, from the month of
   * its date to the month chosen, both included, on the day of the month of its date, or on the
   * last day of a shorter month.
   */
  expensesFor(
    values: PresetValues,
    report: Report,
    today: CalendarDate,
  ): readonly Expense[] | undefined {
    const isComplete = this.parameters.every(
      (parameter) =>
        (parameter.isOptional || isGiven(parameter, values)) &&
        isDateAllowed(parameter, values, today) &&
        this.isMonthOffered(parameter, values, today),
    )
    if (!isComplete) return undefined
    return this.expenses
      .flatMap((expense) => expensesOf(expense, values, report))
      .map((expense) => expense.afterChanging({ presetName: this.name }))
  }

  private isMonthOffered(
    parameter: PresetParameter,
    values: PresetValues,
    today: CalendarDate,
  ): boolean {
    if (parameter.type !== 'month') return true
    const chosen = values.months.get(parameter.id)?.toString()
    return this.monthsOffered(parameter, values, today).some((month) => month.toString() === chosen)
  }
}

function expensesOf(
  expense: PresetExpense,
  values: PresetValues,
  report: Report,
): readonly Expense[] {
  const first = values.dates.get(expense.repeat?.from ?? '')
  const last = values.months.get(expense.repeat?.until ?? '')
  if (first === undefined || last === undefined) {
    return [writtenExpense(expense, values, report, undefined, undefined)]
  }
  const start = CalendarMonth.of(first)
  return start
    .andFollowing(start.monthsUntil(last) + 1)
    .map((month) => writtenExpense(expense, values, report, month, month.dateOn(first.day)))
}

function writtenExpense(
  expense: PresetExpense,
  values: PresetValues,
  report: Report,
  month: CalendarMonth | undefined,
  repetition: CalendarDate | undefined,
): Expense {
  const foreign = values.foreignAmounts.get(expense.foreignAmount ?? '')
  const namedDates: Readonly<Record<string, CalendarDate | undefined>> = {
    firstDay: report.firstDay,
    lastDay: report.lastDay,
    repetition,
  }
  const words: Readonly<Record<string, string | undefined>> = {
    month: month?.name,
    year: month?.year.toString(),
  }
  return new Expense({
    date: namedDates[expense.date ?? ''] ?? values.dates.get(expense.date ?? ''),
    description: expense.description.replaceAll(
      placeholder,
      (_, word: string) => words[word] ?? values.texts.get(word) ?? '',
    ),
    claimedAmount: values.amounts.get(expense.claimedAmount ?? ''),
    isPaidInAnotherCurrency: foreign !== undefined,
    foreignAmount: foreign?.amount,
    currency: foreign?.currency,
  })
}

/** The expense presets of the system. */
export class ExpensePresets {
  readonly all: readonly ExpensePreset[]

  private constructor(all: readonly ExpensePreset[]) {
    this.all = all
  }

  /**
   * The presets a configuration gives, as `config/expense-presets.json` holds them, no two of the
   * same name. Throws as `ExpensePreset.from` does, a TypeError when it holds no list of presets.
   */
  static from(configuration: unknown): ExpensePresets {
    const { presets } = fieldsOf(configuration, 'The expense presets', ['presets'])
    if (!Array.isArray(presets)) {
      throw new TypeError('The expense presets hold no list of presets')
    }
    const all = presets.map((preset) => ExpensePreset.from(preset))
    if (new Set(all.map((preset) => preset.name)).size < all.length) {
      throw new RangeError('Two expense presets have one name')
    }
    return new ExpensePresets(all)
  }

  /** The presets offered to a report, in the order of the file. */
  offeredTo(report: Report): readonly ExpensePreset[] {
    return this.all.filter((preset) => preset.isOfferedTo(report))
  }
}

/** The expense presets, from `config/expense-presets.json`, read when the system is built. */
export const expensePresets = ExpensePresets.from(configured)
