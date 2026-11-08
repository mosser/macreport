import type { Amount } from './amount.ts'
import type { CalendarDate } from './calendar-date.ts'
import { Currency } from './currency.ts'
import { Meal } from './meal.ts'

/** What a per diem is made of, besides its day; a per diem starts domestic, no meal claimed. */
export interface PerDiemFields {
  readonly isInternational?: boolean | undefined
  readonly mealsClaimed?: readonly Meal[] | undefined
  readonly reasons?: ReadonlyMap<Meal, string> | undefined
}

/**
 * What a business travel claims for the meals of one of its days, at their rates rather than on
 * receipts: domestic or international, the meals claimed, and, for a meal not claimed, the reason
 * when the Claimant gives one.
 */
export class PerDiem {
  readonly date: CalendarDate
  /** Whether the per diem is international, at its rates in US dollars; domestic otherwise. */
  readonly isInternational: boolean
  /** The meals claimed, each once, in the order of a day. */
  readonly mealsClaimed: readonly Meal[]
  /** The reason a meal is not claimed, for the meals not claimed the Claimant gave one for. */
  readonly reasons: ReadonlyMap<Meal, string>

  /** Throws a TypeError when a meal claimed is given a reason not to be. */
  constructor(date: CalendarDate, fields: PerDiemFields = {}) {
    const claimed = new Set(fields.mealsClaimed ?? [])
    const reasons = fields.reasons ?? new Map<Meal, string>()
    if ([...reasons.keys()].some((meal) => claimed.has(meal))) {
      throw new TypeError('A meal claimed has no reason not to be')
    }
    this.date = date
    this.isInternational = fields.isInternational ?? false
    this.mealsClaimed = Meal.all.filter((meal) => claimed.has(meal))
    this.reasons = new Map(
      Meal.all.flatMap((meal) => (reasons.has(meal) ? [[meal, reasons.get(meal) ?? '']] : [])),
    )
  }

  /** Whether the per diem claims a meal. */
  isClaiming(meal: Meal): boolean {
    return this.mealsClaimed.includes(meal)
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

  /** The sum of the rates of the meals claimed, in the currency of its rates; none without a meal. */
  get amount(): Amount | undefined {
    return this.mealsClaimed
      .map((meal) => meal.rate)
      .reduce<Amount | undefined>((total, rate) => total?.plus(rate) ?? rate, undefined)
  }

  /** The currency of an international per diem's rates, the US dollar; none for a domestic one. */
  get currency(): Currency | undefined {
    return this.isInternational ? Currency.usDollar : undefined
  }

  /** The amount, as $113.50 for a domestic per diem, USD 86.10 for an international one; empty without a meal. */
  get amountText(): string {
    return this.amount === undefined ? '' : this.written(this.amount)
  }

  /** The rate of a meal, as $28.40 for a domestic per diem, USD 28.40 for an international one. */
  rateTextOf(meal: Meal): string {
    return this.written(meal.rate)
  }

  /** An amount in the currency of the per diem's rates. */
  private written(amount: Amount): string {
    const { currency } = this
    return currency === undefined ? amount.toString() : amount.inCurrency(currency)
  }

  /** The same per diem, with the fields given changed. */
  afterChanging(changes: PerDiemFields): PerDiem {
    return new PerDiem(this.date, {
      isInternational: this.isInternational,
      mealsClaimed: this.mealsClaimed,
      reasons: this.reasons,
      ...changes,
    })
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
