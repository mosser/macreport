import { CalendarDate } from './calendar-date.ts'

const isoMonth = /^(\d{4})-(\d{2})$/

/** The months by their names in English, counted in UTC as a calendar date is. */
const monthName = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' })

/** A month of a year. */
export class CalendarMonth {
  readonly year: number
  readonly month: number

  /** Throws a RangeError for a month that does not exist. */
  constructor(year: number, month: number) {
    if (
      !Number.isInteger(year) ||
      year < 1 ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      throw new RangeError(`${year}-${month} is not a month`)
    }
    this.year = year
    this.month = month
  }

  /** The month a calendar date falls in. */
  static of(date: CalendarDate): CalendarMonth {
    return new CalendarMonth(date.year, date.month)
  }

  /** The month written as YYYY-MM, or absent when the text is not one. */
  static parse(text: string): CalendarMonth | undefined {
    const match = isoMonth.exec(text.trim())
    if (match === null) {
      return undefined
    }
    try {
      return new CalendarMonth(Number(match[1]), Number(match[2]))
    } catch {
      return undefined
    }
  }

  /** The months from this one, as many as asked for. */
  andFollowing(count: number): readonly CalendarMonth[] {
    return Array.from({ length: count }, (_, index) => this.plus(index))
  }

  /** The date of a day of this month, or its last day when the month is shorter. */
  dateOn(day: number): CalendarDate {
    const lastDay = new Date(Date.UTC(this.year, this.month, 0)).getUTCDate()
    return new CalendarDate(this.year, this.month, Math.min(day, lastDay))
  }

  /** The number of months from this one to the other, negative when the other comes first. */
  monthsUntil(other: CalendarMonth): number {
    return (other.year - this.year) * 12 + other.month - this.month
  }

  /** The name of the month, in full, in English: January. */
  get name(): string {
    return monthName.format(new Date(Date.UTC(this.year, this.month - 1, 1)))
  }

  /** The month in full and its year: January 2026. */
  get inFull(): string {
    return `${this.name} ${this.year}`
  }

  /** The month as YYYY-MM. */
  toString(): string {
    return `${String(this.year).padStart(4, '0')}-${String(this.month).padStart(2, '0')}`
  }

  private plus(count: number): CalendarMonth {
    const months = this.year * 12 + this.month - 1 + count
    return new CalendarMonth(Math.floor(months / 12), (months % 12) + 1)
  }
}
