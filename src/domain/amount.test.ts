import { describe, expect, it } from 'vitest'
import { Amount } from './amount.ts'
import { Currency } from './currency.ts'

describe('Amount', () => {
  it('is more than zero, to the cent', () => {
    expect(new Amount(1).cents).toBe(1)
    expect(() => new Amount(0)).toThrow(RangeError)
    expect(() => new Amount(-5)).toThrow(RangeError)
    expect(() => new Amount(1.5)).toThrow(RangeError)
  })

  it('reads dollars with at most two decimals', () => {
    expect(Amount.parse('1012.35')?.cents).toBe(101235)
    expect(Amount.parse('87.1')?.cents).toBe(8710)
    expect(Amount.parse('12')?.cents).toBe(1200)
    expect(Amount.parse('0.01')?.cents).toBe(1)
    expect(Amount.parse('0')).toBeUndefined()
    expect(Amount.parse('0.00')).toBeUndefined()
    expect(Amount.parse('1.234')).toBeUndefined()
    expect(Amount.parse('-3')).toBeUndefined()
    expect(Amount.parse('twelve')).toBeUndefined()
    expect(Amount.parse('99999999999999999999')).toBeUndefined()
  })

  it('adds and writes itself in dollars', () => {
    expect(new Amount(101235).plus(new Amount(8710)).toString()).toBe('$1,099.45')
    expect(new Amount(5).toString()).toBe('$0.05')
    expect(new Amount(123456789).toString()).toBe('$1,234,567.89')
  })

  it('writes itself in another currency, by its code, and as typed in a field', () => {
    const euro = Currency.parse('EUR')
    if (euro === undefined) throw new TypeError('EUR is a currency')
    expect(new Amount(164000).inCurrency(euro)).toBe('EUR 1,640.00')
    expect(new Amount(5500).inCurrency(euro)).toBe('EUR 55.00')
    expect(new Amount(164000).typed).toBe('1640.00')
  })
})
