import { describe, expect, it } from 'vitest'
import { CalendarDate } from './calendar-date.ts'

describe('CalendarDate', () => {
  it('is a day that exists in the calendar', () => {
    expect(new CalendarDate(2024, 2, 29).toString()).toBe('2024-02-29')
    expect(() => new CalendarDate(2026, 2, 29)).toThrow(RangeError)
    expect(() => new CalendarDate(2026, 13, 1)).toThrow(RangeError)
    expect(() => new CalendarDate(0, 1, 1)).toThrow(RangeError)
  })

  it('reads a date written as YYYY-MM-DD, and nothing else', () => {
    expect(CalendarDate.parse(' 2026-10-03 ')?.toString()).toBe('2026-10-03')
    expect(CalendarDate.parse('2026-02-30')).toBeUndefined()
    expect(CalendarDate.parse('03/10/2026')).toBeUndefined()
    expect(CalendarDate.parse('')).toBeUndefined()
  })

  it('compares two dates', () => {
    const first = new CalendarDate(2026, 10, 3)
    const last = new CalendarDate(2026, 10, 5)
    expect(first.isBefore(last)).toBe(true)
    expect(last.isBefore(first)).toBe(false)
    expect(first.equals(new CalendarDate(2026, 10, 3))).toBe(true)
    expect(new CalendarDate(2025, 12, 31).compareTo(first)).toBeLessThan(0)
  })

  it('gives the day after, across a month and a year', () => {
    expect(new CalendarDate(2026, 10, 3).dayAfter.toString()).toBe('2026-10-04')
    expect(new CalendarDate(2028, 2, 28).dayAfter.toString()).toBe('2028-02-29')
    expect(new CalendarDate(2026, 12, 31).dayAfter.toString()).toBe('2027-01-01')
  })

  it('names the day of the week it falls on', () => {
    expect(new CalendarDate(2026, 10, 3).dayOfWeek).toBe('Saturday')
    expect(new CalendarDate(2028, 2, 29).dayOfWeek).toBe('Tuesday')
  })
})
