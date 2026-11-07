const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/

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
