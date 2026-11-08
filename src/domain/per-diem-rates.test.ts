import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Meal } from './meal.ts'
import { PerDiemRates, perDiemRates } from './per-diem-rates.ts'

const rates = { breakfast: '28.40', lunch: '27.40', dinner: '57.70' }
const configuration = { domestic: rates, international: { ...rates, dinner: '60' } }

describe('PerDiemRates', () => {
  it('reads a rate per meal, domestic and international, from the configuration', () => {
    const read = PerDiemRates.from(configuration)
    expect(read.rateOf(Meal.lunch, false).typed).toBe('27.40')
    expect(read.rateOf(Meal.dinner, false).typed).toBe('57.70')
    expect(read.rateOf(Meal.dinner, true).typed).toBe('60.00')
  })

  it('are those of config/per-diems.json', () => {
    const file = JSON.parse(readFileSync('config/per-diems.json', 'utf8'))
    const read = PerDiemRates.from(file)
    for (const meal of Meal.all) {
      for (const isInternational of [false, true]) {
        expect(perDiemRates.rateOf(meal, isInternational)).toEqual(
          read.rateOf(meal, isInternational),
        )
      }
    }
  })

  it('refuses a configuration that misses a rate, or holds anything else', () => {
    for (const broken of [
      undefined,
      [],
      'rates',
      { domestic: rates },
      { ...configuration, other: rates },
      { domestic: rates, international: { breakfast: '28.40', lunch: '27.40' } },
      { domestic: { ...rates, diner: '57.70' }, international: rates },
    ]) {
      expect(() => PerDiemRates.from(broken), JSON.stringify(broken)).toThrow(TypeError)
    }
  })

  it('refuses a rate that is not an amount more than zero, at most two decimals', () => {
    for (const rate of ['0', '-1', '28.405', '28,40', 28.4]) {
      const broken = { domestic: { ...rates, lunch: rate }, international: rates }
      expect(() => PerDiemRates.from(broken), String(rate)).toThrow(RangeError)
    }
  })
})
