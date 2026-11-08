import { describe, expect, it } from 'vitest'
import { Policy, policy } from './policy.ts'

const document = { name: 'AP-01 Policy', url: 'https://example.org/ap-01.pdf' }

describe('Policy', () => {
  it('keeps the documents of its configuration, in their order', () => {
    const other = { name: 'AP-01 Guidelines', url: 'https://example.org/guidelines.pdf' }
    expect(Policy.from({ documents: [document, other] }).documents).toEqual([document, other])
  })

  it.each([
    ['nothing', undefined],
    ['a text', 'AP-01'],
    ['no documents', {}],
    ['an empty list', { documents: [] }],
    ['a document that is nothing', { documents: [null] }],
    ['a document without a name', { documents: [{ url: document.url }] }],
    ['a document without an address', { documents: [{ name: document.name }] }],
  ])('refuses a configuration holding %s', (_what, configuration) => {
    expect(() => Policy.from(configuration)).toThrow(TypeError)
  })

  it.each([
    ['an empty name', { ...document, name: ' ' }],
    ['a name the report document cannot write', { ...document, name: '方針' }],
    ['an address that is none', { ...document, url: 'ap-01.pdf' }],
    ['an address that is not https', { ...document, url: 'http://example.org/ap-01.pdf' }],
  ])('refuses %s', (_what, entry) => {
    expect(() => Policy.from({ documents: [entry] })).toThrow(RangeError)
  })

  it('reads the policy of the system from its configuration: AP-01, its policy and guidelines', () => {
    expect(policy.documents.map(({ name }) => name)).toEqual(['AP01 - Policy', 'AP01 - Guidelines'])
    for (const { url } of policy.documents) {
      expect(new URL(url).protocol).toBe('https:')
    }
  })
})
