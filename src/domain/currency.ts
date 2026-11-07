/**
 * The three-letter ISO 4217 codes of the currencies in use, the Canadian dollar aside, and of
 * those withdrawn recently enough to be on a receipt still.
 */
const codes = [
  'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN',
  'BWP BYN BZD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP',
  'GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES',
  'KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU',
  'MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON',
  'RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT',
  'TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VED VES VND VUV WST XAF XCD XCG XOF XPF YER',
  'ZAR ZMW ZWG ZWL',
]
  .join(' ')
  .split(' ')

/** The English names of currencies, as the JavaScript runtime knows them. */
const names = new Intl.DisplayNames('en', { type: 'currency', fallback: 'code' })

/** A currency other than the Canadian dollar, by its three-letter ISO 4217 code: EUR, USD, JPY. */
export class Currency {
  /** Every currency, by its code in alphabetical order. */
  static readonly all: readonly Currency[] = codes.map((code) => new Currency(code))

  readonly code: string

  private constructor(code: string) {
    this.code = code
  }

  /**
   * The currency of a three-letter ISO 4217 code other than CAD, whatever its case, or absent
   * when the text is not one. Each currency is one object: two of the same code are the same.
   */
  static parse(text: string): Currency | undefined {
    const code = text.trim().toUpperCase()
    return Currency.all.find((currency) => currency.code === code)
  }

  /** The currency's name in English, as Euro; its code when the runtime does not know it. */
  get name(): string {
    return names.of(this.code) ?? this.code
  }

  /** The currency as its code. */
  toString(): string {
    return this.code
  }
}
