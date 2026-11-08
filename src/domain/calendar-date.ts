const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/

/** The days of the week by their names in English, counted in UTC as a calendar date is. */
const dayOfWeek = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' })
const shortDayOfWeek = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' })

/** A calendar date: a day of a month of a year, that exists in the calendar. */
export class CalendarDate {
  readonly year: number
  readonly month: number
  readonly day: number

  /** Throws a RangeError for a day that does not exist, such as February 30. */
  constructor(year: number, month: number, day: number) {
    const probe = new Date(Date.UTC(year, month - 1, day))
    const exists =
      Number.isInteger(year) &&
      year >= 1 &&
      probe.getUTCFullYear() === year &&
      probe.getUTCMonth() === month - 1 &&
      probe.getUTCDate() === day
    if (!exists) {
      throw new RangeError(`${year}-${month}-${day} is not a calendar date`)
    }
    this.year = year
    this.month = month
    this.day = day
  }

  /** The calendar date written as YYYY-MM-DD, or absent when the text is not one. */
  static parse(text: string): CalendarDate | undefined {
    const match = isoDate.exec(text.trim())
    if (match === null) {
      return undefined
    }
    try {
      return new CalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))
    } catch {
      return undefined
    }
  }

  /** The day of the week this date falls on, in English: Saturday. */
  get dayOfWeek(): string {
    return dayOfWeek.format(new Date(Date.UTC(this.year, this.month - 1, this.day)))
  }

  /** The date as a list of expenses shows it, after the start of its day of the week: Sat 2026-10-03. */
  get withDayOfWeek(): string {
    const day = shortDayOfWeek.format(new Date(Date.UTC(this.year, this.month - 1, this.day)))
    return `${day} ${this}`
  }

  /** The day after this one. */
  get dayAfter(): CalendarDate {
    const next = new Date(Date.UTC(this.year, this.month - 1, this.day + 1))
    return new CalendarDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())
  }

  /** Whether this date comes before the other one. */
  isBefore(other: CalendarDate): boolean {
    return this.compareTo(other) < 0
  }

  /** Negative when this date comes first, zero for the same day, positive otherwise. */
  compareTo(other: CalendarDate): number {
    return this.year - other.year || this.month - other.month || this.day - other.day
  }

  /** Whether both are the same day. */
  equals(other: CalendarDate): boolean {
    return this.compareTo(other) === 0
  }

  /** The date as YYYY-MM-DD. */
  toString(): string {
    const month = String(this.month).padStart(2, '0')
    const day = String(this.day).padStart(2, '0')
    return `${String(this.year).padStart(4, '0')}-${month}-${day}`
  }
}
