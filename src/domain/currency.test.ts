import { describe, expect, it } from 'vitest'
import { Currency } from './currency.ts'

describe('Currency', () => {
  it('reads a three-letter ISO 4217 code, whatever its case, other than CAD', () => {
    expect(Currency.parse('EUR')?.code).toBe('EUR')
    expect(Currency.parse(' usd ')?.code).toBe('USD')
    expect(Currency.parse('JPY')?.toString()).toBe('JPY')
    expect(Currency.parse('CAD')).toBeUndefined()
    expect(Currency.parse('EU')).toBeUndefined()
    expect(Currency.parse('ABC')).toBeUndefined()
    expect(Currency.parse('')).toBeUndefined()
  })

  it('has an English name, or its code when the runtime does not know it', () => {
    expect(Currency.parse('EUR')?.name).toBe('Euro')
    expect(Currency.parse('JPY')?.name).toBe('Japanese Yen')
    expect(Currency.all.every((currency) => currency.name.length > 0)).toBe(true)
  })

  it('is one object per code, offered in alphabetical order', () => {
    expect(Currency.parse('eur')).toBe(Currency.parse('EUR'))
    const codes = Currency.all.map((currency) => currency.code)
    expect(codes).toEqual([...codes].sort())
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.every((code) => /^[A-Z]{3}$/.test(code))).toBe(true)
  })

  it('knows the US dollar, the currency of an international per diem', () => {
    expect(Currency.usDollar).toBe(Currency.parse('USD'))
  })
})
