import { describe, expect, it } from 'vitest'
import { CalendarDate } from './calendar-date.ts'
import { Currency } from './currency.ts'
import { Meal } from './meal.ts'
import { PerDiem } from './per-diem.ts'

const day = new CalendarDate(2026, 10, 4)
const lunchReason = new Map([[Meal.lunch, 'provided by the conference']])

describe('Meal', () => {
  it('is breakfast at 28.40, lunch at 27.40 and dinner at 57.70, in the order of a day', () => {
    expect(Meal.all.map((meal) => [meal.name, meal.title, meal.rate.typed])).toEqual([
      ['breakfast', 'Breakfast', '28.40'],
      ['lunch', 'Lunch', '27.40'],
      ['dinner', 'Dinner', '57.70'],
    ])
    expect(Meal.named('dinner')).toBe(Meal.dinner)
    expect(Meal.named('supper')).toBeUndefined()
  })
})

describe('PerDiem', () => {
  it('starts domestic, no meal claimed, claiming nothing', () => {
    const perDiem = new PerDiem(day)
    expect(perDiem.isInternational).toBe(false)
    expect(perDiem.mealsClaimed).toEqual([])
    expect(perDiem.mealsNotClaimed).toEqual(Meal.all)
    expect(perDiem.hasMealClaimed).toBe(false)
    expect(perDiem.amount).toBeUndefined()
    expect(perDiem.amountText).toBe('')
  })

  it('claims each meal once, in the order of a day, at its rate in Canadian dollars when domestic', () => {
    const perDiem = new PerDiem(day, { mealsClaimed: [Meal.dinner, Meal.breakfast, Meal.dinner] })
    expect(perDiem.mealsClaimed).toEqual([Meal.breakfast, Meal.dinner])
    expect(perDiem.isClaiming(Meal.lunch)).toBe(false)
    expect(perDiem.currency).toBeUndefined()
    expect(perDiem.amountText).toBe('$86.10')
    expect(new PerDiem(day, { mealsClaimed: Meal.all }).amountText).toBe('$113.50')
  })

  it('claims an international per diem at the same rates, in US dollars', () => {
    const perDiem = new PerDiem(day, { isInternational: true, mealsClaimed: [Meal.lunch] })
    expect(perDiem.currency).toBe(Currency.usDollar)
    expect(perDiem.amountText).toBe('USD 27.40')
    expect(perDiem.rateTextOf(Meal.breakfast)).toBe('USD 28.40')
    expect(new PerDiem(day).rateTextOf(Meal.dinner)).toBe('$57.70')
  })

  it('gives a reason only to a meal not claimed, and claiming the meal takes it out', () => {
    expect(() => new PerDiem(day, { mealsClaimed: [Meal.lunch], reasons: lunchReason })).toThrow(
      TypeError,
    )
    const reasoned = new PerDiem(day).afterGivingReason(Meal.lunch, 'provided by the conference')
    expect(reasoned.reasonFor(Meal.lunch)).toBe('provided by the conference')
    expect(reasoned.afterGivingReason(Meal.lunch, undefined).reasonFor(Meal.lunch)).toBeUndefined()
    const claimed = reasoned.afterClaiming(Meal.lunch, true)
    expect(claimed.isClaiming(Meal.lunch)).toBe(true)
    expect(claimed.reasonFor(Meal.lunch)).toBeUndefined()
    const unclaimed = claimed.afterClaiming(Meal.lunch, false)
    expect(unclaimed.mealsClaimed).toEqual([])
    expect(unclaimed.reasonFor(Meal.lunch)).toBeUndefined()
  })

  it('changes from domestic to international, keeping its meals and reasons', () => {
    const perDiem = new PerDiem(day, { mealsClaimed: [Meal.dinner], reasons: lunchReason })
    const changed = perDiem.afterChanging({ isInternational: true })
    expect(changed.isInternational).toBe(true)
    expect(changed.mealsClaimed).toEqual([Meal.dinner])
    expect(changed.reasonFor(Meal.lunch)).toBe('provided by the conference')
    expect(changed.date).toBe(day)
  })
})
