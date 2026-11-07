// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { save } from './save.ts'

describe('save', () => {
  it('hands the report document to the browser under its file name', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const created = vi.spyOn(document, 'createElement')
    save(new Uint8Array([37, 80, 68, 70]), 'expense-report.pdf', document)
    const link = created.mock.results[0]?.value as HTMLAnchorElement
    expect(link.outerHTML).toContain('="expense-report.pdf"')
    expect(link.href).toMatch(/^blob:/)
    expect(click).toHaveBeenCalledOnce()
  })
})
