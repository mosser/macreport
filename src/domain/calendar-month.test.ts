import { describe, expect, it } from 'vitest'
import { CalendarDate } from './calendar-date.ts'
import { CalendarMonth } from './calendar-month.ts'

describe('CalendarMonth', () => {
  it('refuses a month that does not exist', () => {
    for (const [year, month] of [
      [2026, 0],
      [2026, 13],
      [0, 1],
      [2026, 1.5],
    ] as const) {
      expect(() => new CalendarMonth(year, month), `${year}-${month}`).toThrow(RangeError)
    }
  })

  it('reads a month written as YYYY-MM, and nothing else', () => {
    expect(CalendarMonth.parse(' 2026-03 ')?.inFull).toBe('March 2026')
    for (const text of ['', '2026-13', '2026-3', 'March 2026', '2026-03-15']) {
      expect(CalendarMonth.parse(text), text).toBeUndefined()
    }
  })

  it('is the month of a date', () => {
    expect(CalendarMonth.of(new CalendarDate(2026, 2, 14)).toString()).toBe('2026-02')
  })

  it('names the month in full, in English', () => {
    expect(new CalendarMonth(2026, 1).name).toBe('January')
    expect(new CalendarMonth(2026, 12).inFull).toBe('December 2026')
  })

  it('gives the following months, across a year', () => {
    expect(new CalendarMonth(2026, 11).andFollowing(3).map((month) => month.toString())).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ])
  })

  it('counts the months until another', () => {
    const january = new CalendarMonth(2026, 1)
    expect(january.monthsUntil(new CalendarMonth(2026, 1))).toBe(0)
    expect(january.monthsUntil(new CalendarMonth(2027, 3))).toBe(14)
    expect(january.monthsUntil(new CalendarMonth(2025, 12))).toBe(-1)
  })

  it('gives the date of a day, or the last day of a shorter month', () => {
    expect(new CalendarMonth(2026, 1).dateOn(31).toString()).toBe('2026-01-31')
    expect(new CalendarMonth(2026, 2).dateOn(31).toString()).toBe('2026-02-28')
    expect(new CalendarMonth(2028, 2).dateOn(31).toString()).toBe('2028-02-29')
    expect(new CalendarMonth(2026, 4).dateOn(15).toString()).toBe('2026-04-15')
  })
})
