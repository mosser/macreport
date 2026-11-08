import configured from '../../config/per-diems.json' with { type: 'json' }
import { Amount } from './amount.ts'
import { Meal } from './meal.ts'

/** The rate of each meal, as `config/per-diems.json` sets it: domestic or international. */
type Rates = ReadonlyMap<Meal, Amount>

/**
 * What a meal claimed is worth: a rate for each of breakfast, lunch and dinner, in Canadian
 * dollars for a domestic meal, and another, in US dollars, for an international one.
 */
export class PerDiemRates {
  private readonly domestic: Rates
  private readonly international: Rates

  private constructor(domestic: Rates, international: Rates) {
    this.domestic = domestic
    this.international = international
  }

  /**
   * The rates a configuration gives, as `config/per-diems.json` holds them: a domestic and an
   * international rate for each meal, each a text such as "28.40". Throws a TypeError when the
   * configuration holds anything else, or misses a rate; a RangeError when a rate is not an amount
   * more than zero, at most two decimals.
   */
  static from(configuration: unknown): PerDiemRates {
    const scopes = entriesOf(configuration, ['domestic', 'international'], 'The per diem rates')
    return new PerDiemRates(
      ratesOf(scopes.get('domestic'), 'domestic'),
      ratesOf(scopes.get('international'), 'international'),
    )
  }

  /** The rate of a meal, domestic in Canadian dollars, or international in US dollars. */
  rateOf(meal: Meal, isInternational: boolean): Amount {
    const rate = (isInternational ? this.international : this.domestic).get(meal)
    if (rate === undefined) {
      throw new RangeError(`No rate for ${meal.name}`)
    }
    return rate
  }
}

/** The rate of each meal of a scope of the configuration. */
function ratesOf(value: unknown, scope: string): Rates {
  const names = Meal.all.map((meal) => meal.name)
  const rates = entriesOf(value, names, `The ${scope} per diem rates`)
  return new Map(
    Meal.all.map((meal) => {
      const text = rates.get(meal.name)
      const rate = typeof text === 'string' ? Amount.parse(text) : undefined
      if (rate === undefined) {
        throw new RangeError(
          `The ${scope} rate of ${meal.name} is not an amount more than zero, at most two decimals`,
        )
      }
      return [meal, rate]
    }),
  )
}

/** The entries of an object holding exactly the keys given; throws a TypeError otherwise. */
function entriesOf(value: unknown, keys: readonly string[], what: string): Map<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${what} are not an object`)
  }
  const entries = new Map(Object.entries(value))
  const isExactly = entries.size === keys.length && keys.every((key) => entries.has(key))
  if (!isExactly) {
    throw new TypeError(`${what} hold exactly ${keys.join(', ')}`)
  }
  return entries
}

/** The rates of the system, from `config/per-diems.json`, read when the system is built. */
export const perDiemRates = PerDiemRates.from(configured)
