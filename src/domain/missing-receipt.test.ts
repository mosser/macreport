import { describe, expect, it } from 'vitest'
import { MissingReceipt } from './missing-receipt.ts'

const stated = { reason: 'Lost in a taxi', paidTo: 'Taxi Rio', jobTitle: 'PhD Student' }

describe('MissingReceipt', () => {
  it('holds the reason, who was paid and the job title, each in its composed form', () => {
    const missing = new MissingReceipt({ ...stated, paidTo: ' Café Rio ' })
    expect(missing.reason).toBe('Lost in a taxi')
    expect(missing.paidTo).toBe('Café Rio')
    expect(missing.jobTitle).toBe('PhD Student')
  })

  it('keeps the line breaks of its reason', () => {
    expect(new MissingReceipt({ ...stated, reason: 'Lost\nin a taxi' }).reason).toBe(
      'Lost\nin a taxi',
    )
  })

  it('refuses a blank reason, payee or job title', () => {
    expect(() => new MissingReceipt({ ...stated, reason: ' ' })).toThrow(
      new TypeError('A missing receipt has a reason'),
    )
    expect(() => new MissingReceipt({ ...stated, paidTo: '' })).toThrow(
      new TypeError('A missing receipt has who was paid'),
    )
    expect(() => new MissingReceipt({ ...stated, jobTitle: '' })).toThrow(
      new TypeError('A missing receipt has a job title'),
    )
  })

  it('takes a phone extension or none, a blank one being none', () => {
    expect(new MissingReceipt(stated).phoneExtension).toBeUndefined()
    expect(new MissingReceipt({ ...stated, phoneExtension: ' ' }).phoneExtension).toBeUndefined()
    expect(new MissingReceipt({ ...stated, phoneExtension: '24242' }).phoneExtension).toBe('24242')
  })
})
