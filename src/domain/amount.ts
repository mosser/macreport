const decimalAmount = /^(\d+)(?:\.(\d{1,2}))?$/

/** An amount in Canadian dollars: always more than zero, to the cent. */
export class Amount {
  readonly cents: number

  /** Throws a RangeError unless the cents are a whole number above zero. */
  constructor(cents: number) {
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new RangeError(`${cents} is not a whole number of cents above zero`)
    }
    this.cents = cents
  }

  /** The amount written in dollars with at most two decimals, or absent when the text is not one. */
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

  /** The amount as $1,012.35. */
  toString(): string {
    const dollars = Math.floor(this.cents / 100)
    const cents = String(this.cents % 100).padStart(2, '0')
    const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return `$${grouped}.${cents}`
  }
}
