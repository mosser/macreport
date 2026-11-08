import type { Currency } from './currency.ts'

const decimalAmount = /^(\d+)(?:\.(\d{1,2}))?$/

/**
 * An amount of money: always more than zero, to the cent. A claimed amount is in Canadian dollars,
 * a foreign amount in its currency.
 */
export class Amount {
  readonly cents: number

  /** Throws a RangeError unless the cents are a whole number above zero. */
  constructor(cents: number) {
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new RangeError(`${cents} is not a whole number of cents above zero`)
    }
    this.cents = cents
  }

  /** The amount written with at most two decimals, or absent when the text is not one. */
  static parse(text: string): Amount | undefined {
    const match = decimalAmount.exec(text.trim())
    if (match === null) {
      return undefined
    }
    const dollars = Number(match[1])
    const cents = Number((match[2] ?? '').padEnd(2, '0'))
    const total = dollars * 100 + cents
    return total > 0 && Number.isSafeInteger(total) ? new Amount(total) : undefined
  }

  /** The sum of this amount and the other one. */
  plus(other: Amount): Amount {
    return new Amount(this.cents + other.cents)
  }

  /** The amount as typed in a field: 1012.35, without grouping. */
  get typed(): string {
    return (this.cents / 100).toFixed(2)
  }

  /** The amount in Canadian dollars, as $1,012.35. */
  toString(): string {
    return `$${this.grouped}`
  }

  /** The amount in a currency other than the Canadian dollar, as EUR 1,012.35. */
  inCurrency(currency: Currency): string {
    return `${currency.code} ${this.grouped}`
  }

  /** The amount as 1,012.35, its thousands grouped. */
  get grouped(): string {
    const dollars = Math.floor(this.cents / 100)
    const cents = String(this.cents % 100).padStart(2, '0')
    const digits = [...String(dollars)]
    const grouped = digits
      .map((digit, index) => ((digits.length - index) % 3 === 0 && index > 0 ? `,${digit}` : digit))
      .join('')
    return `${grouped}.${cents}`
  }
}
