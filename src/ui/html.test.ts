import { describe, expect, it } from 'vitest'
import { escaped, html, raw } from './html.ts'

describe('html', () => {
  it('escapes every interpolated value', () => {
    const typed = `<img src=x onerror="alert('x')">&`
    expect(html`<p>${typed}</p>`.text).toBe(
      '<p>&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;</p>',
    )
    expect(escaped('a & b')).toBe('a &amp; b')
  })

  it('inserts markup and nested templates as they are, and lists one after the other', () => {
    const items = ['one', '<two>'].map((item) => html`<li>${item}</li>`)
    expect(html`<ul>${items}</ul>${raw('<hr>')}`.text).toBe(
      '<ul><li>one</li><li>&lt;two&gt;</li></ul><hr>',
    )
  })

  it('writes numbers, and nothing for an absent value or a boolean', () => {
    expect(html`${1}|${undefined}|${false}|${true}`.toString()).toBe('1|||')
  })
})
