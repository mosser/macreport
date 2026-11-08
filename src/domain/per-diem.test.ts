import { describe, expect, it } from 'vitest'
import { CalendarDate } from './calendar-date.ts'
import { Meal } from './meal.ts'
import { PerDiem } from './per-diem.ts'

const day = new CalendarDate(2026, 10, 4)
const lunchReason = new Map([[Meal.lunch, 'provided by the conference']])

describe('Meal', () => {
  it('is breakfast, lunch and dinner, in the order of a day', () => {
    expect(Meal.all.map((meal) => [meal.name, meal.title])).toEqual([
      ['breakfast', 'Breakfast'],
      ['lunch', 'Lunch'],
      ['dinner', 'Dinner'],
    ])
    expect(Meal.named('dinner')).toBe(Meal.dinner)
    expect(Meal.named('supper')).toBeUndefined()
  })
})

describe('PerDiem', () => {
  it('starts every meal domestic, no meal claimed, claiming nothing', () => {
    const perDiem = new PerDiem(day)
    expect(perDiem.isEveryMealDomestic).toBe(true)
    expect(perDiem.isEveryMealInternational).toBe(false)
    expect(perDiem.mealsClaimed).toEqual([])
    expect(perDiem.mealsNotClaimed).toEqual(Meal.all)
    expect(perDiem.hasMealClaimed).toBe(false)
    expect(perDiem.amountOfMealsThat(false)).toBeUndefined()
    expect(perDiem.amountTexts).toEqual([])
  })

  it('claims each meal once, in the order of a day, a domestic one at its rate in Canadian dollars', () => {
    const perDiem = new PerDiem(day, { mealsClaimed: [Meal.dinner, Meal.breakfast, Meal.dinner] })
    expect(perDiem.mealsClaimed).toEqual([Meal.breakfast, Meal.dinner])
    expect(perDiem.isClaiming(Meal.lunch)).toBe(false)
    expect(perDiem.amountTexts).toEqual(['$86.10'])
    expect(perDiem.rateTextOf(Meal.dinner)).toBe('$57.70')
    expect(new PerDiem(day, { mealsClaimed: Meal.all }).amountTexts).toEqual(['$113.50'])
  })

  it('claims an international meal at the same rate, in US dollars, apart from the domestic ones', () => {
    const perDiem = new PerDiem(day, {
      mealsClaimed: Meal.all,
      internationalMeals: [Meal.dinner, Meal.lunch],
    })
    expect(perDiem.internationalMeals).toEqual([Meal.lunch, Meal.dinner])
    expect(perDiem.isInternational(Meal.breakfast)).toBe(false)
    expect(perDiem.mealsClaimedThat(true)).toEqual([Meal.lunch, Meal.dinner])
    expect(perDiem.mealsClaimedThat(false)).toEqual([Meal.breakfast])
    expect(perDiem.amountTexts).toEqual(['$28.40', 'USD 85.10'])
    expect(perDiem.rateTextOf(Meal.lunch)).toBe('USD 27.40')
    expect(perDiem.isEveryMealDomestic || perDiem.isEveryMealInternational).toBe(false)
  })

  it('makes every meal, or one meal, domestic or international', () => {
    const perDiem = new PerDiem(day, { mealsClaimed: [Meal.dinner], reasons: lunchReason })
    const international = perDiem.afterMakingEveryMeal(true)
    expect(international.isEveryMealInternational).toBe(true)
    expect(international.mealsClaimed).toEqual([Meal.dinner])
    expect(international.reasonFor(Meal.lunch)).toBe('provided by the conference')
    expect(international.date).toBe(day)
    const breakfast = international.afterMaking(Meal.breakfast, false)
    expect(breakfast.internationalMeals).toEqual([Meal.lunch, Meal.dinner])
    expect(breakfast.afterMaking(Meal.breakfast, true).isEveryMealInternational).toBe(true)
    expect(international.afterMakingEveryMeal(false).isEveryMealDomestic).toBe(true)
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
})
