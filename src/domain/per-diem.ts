import type { Amount } from './amount.ts'
import type { CalendarDate } from './calendar-date.ts'
import { Currency } from './currency.ts'
import { Meal } from './meal.ts'
import { perDiemRates } from './per-diem-rates.ts'

/** What a per diem is made of, besides its day; a per diem starts all domestic, no meal claimed. */
export interface PerDiemFields {
  readonly internationalMeals?: readonly Meal[] | undefined
  readonly mealsClaimed?: readonly Meal[] | undefined
  readonly reasons?: ReadonlyMap<Meal, string> | undefined
}

/**
 * What a business travel claims for the meals of one of its days, at their rates rather than on
 * receipts: each meal domestic or international, the meals claimed, and, for a meal not claimed,
 * the reason when the Claimant gives one.
 */
export class PerDiem {
  readonly date: CalendarDate
  /** The meals that are international, at their rates in US dollars, in the order of a day; the others are domestic. */
  readonly internationalMeals: readonly Meal[]
  /** The meals claimed, each once, in the order of a day. */
  readonly mealsClaimed: readonly Meal[]
  /** The reason a meal is not claimed, for the meals not claimed the Claimant gave one for. */
  readonly reasons: ReadonlyMap<Meal, string>

  /** Throws a TypeError when a meal claimed is given a reason not to be. */
  constructor(date: CalendarDate, fields: PerDiemFields = {}) {
    const claimed = new Set(fields.mealsClaimed ?? [])
    const international = new Set(fields.internationalMeals ?? [])
    const reasons = fields.reasons ?? new Map<Meal, string>()
    if ([...reasons.keys()].some((meal) => claimed.has(meal))) {
      throw new TypeError('A meal claimed has no reason not to be')
    }
    this.date = date
    this.internationalMeals = Meal.all.filter((meal) => international.has(meal))
    this.mealsClaimed = Meal.all.filter((meal) => claimed.has(meal))
    this.reasons = new Map(
      Meal.all.flatMap((meal) => (reasons.has(meal) ? [[meal, reasons.get(meal) ?? '']] : [])),
    )
  }

  /** Whether the per diem claims a meal. */
  isClaiming(meal: Meal): boolean {
    return this.mealsClaimed.includes(meal)
  }

  /** Whether a meal is international, at its rate in US dollars; domestic otherwise. */
  isInternational(meal: Meal): boolean {
    return this.internationalMeals.includes(meal)
  }

  /** Whether every meal of the day is domestic. */
  get isEveryMealDomestic(): boolean {
    return this.internationalMeals.length === 0
  }

  /** Whether every meal of the day is international. */
  get isEveryMealInternational(): boolean {
    return this.internationalMeals.length === Meal.all.length
  }

  /** The reason a meal is not claimed, when the Claimant gave one. */
  reasonFor(meal: Meal): string | undefined {
    return this.reasons.get(meal)
  }

  /** The meals not claimed, in the order of a day. */
  get mealsNotClaimed(): readonly Meal[] {
    return Meal.all.filter((meal) => !this.isClaiming(meal))
  }

  /** Whether the per diem claims at least one meal; one that claims none claims nothing. */
  get hasMealClaimed(): boolean {
    return this.mealsClaimed.length > 0
  }

  /** The meals claimed that are international, or those that are domestic, in the order of a day. */
  mealsClaimedThat(areInternational: boolean): readonly Meal[] {
    return this.mealsClaimed.filter((meal) => this.isInternational(meal) === areInternational)
  }

  /**
   * The sum of the rates of the meals claimed that are international, in US dollars, or of those
   * that are domestic, in Canadian dollars; none without such a meal.
   */
  amountOfMealsThat(areInternational: boolean): Amount | undefined {
    return this.mealsClaimedThat(areInternational)
      .map((meal) => perDiemRates.rateOf(meal, areInternational))
      .reduce<Amount | undefined>((total, rate) => total?.plus(rate) ?? rate, undefined)
  }

  /**
   * What the per diem claims, one amount per currency: $86.10 for its domestic meals, then
   * USD 57.70 for its international ones; none without a meal claimed.
   */
  get amountTexts(): readonly string[] {
    const domestic = this.amountOfMealsThat(false)
    const international = this.amountOfMealsThat(true)
    return [
      ...(domestic === undefined ? [] : [domestic.toString()]),
      ...(international === undefined ? [] : [international.inCurrency(Currency.usDollar)]),
    ]
  }

  /** The rate of a meal, as $28.40 for a domestic meal, USD 28.40 for an international one. */
  rateTextOf(meal: Meal): string {
    const isInternational = this.isInternational(meal)
    const rate = perDiemRates.rateOf(meal, isInternational)
    return isInternational ? rate.inCurrency(Currency.usDollar) : rate.toString()
  }

  /** The same per diem, with the fields given changed. */
  afterChanging(changes: PerDiemFields): PerDiem {
    return new PerDiem(this.date, {
      internationalMeals: this.internationalMeals,
      mealsClaimed: this.mealsClaimed,
      reasons: this.reasons,
      ...changes,
    })
  }

  /** The same per diem, every meal domestic, or every meal international. */
  afterMakingEveryMeal(isInternational: boolean): PerDiem {
    return this.afterChanging({ internationalMeals: isInternational ? Meal.all : [] })
  }

  /** The same per diem, one meal domestic or international. */
  afterMaking(meal: Meal, isInternational: boolean): PerDiem {
    const others = this.internationalMeals.filter((international) => international !== meal)
    return this.afterChanging({ internationalMeals: isInternational ? [...others, meal] : others })
  }

  /** The same per diem, a meal claimed or not: claiming a meal takes its reason out. */
  afterClaiming(meal: Meal, isClaimed: boolean): PerDiem {
    const others = this.mealsClaimed.filter((claimed) => claimed !== meal)
    const reasons = new Map(this.reasons)
    if (isClaimed) {
      reasons.delete(meal)
    }
    return this.afterChanging({ mealsClaimed: isClaimed ? [...others, meal] : others, reasons })
  }

  /** The same per diem, with the reason a meal not claimed is not, or without one when absent. */
  afterGivingReason(meal: Meal, reason: string | undefined): PerDiem {
    const reasons = new Map(this.reasons)
    if (reason === undefined) {
      reasons.delete(meal)
    } else {
      reasons.set(meal, reason)
    }
    return this.afterChanging({ reasons })
  }
}
