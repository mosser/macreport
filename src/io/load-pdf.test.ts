import { PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { loadedPdf } from './load-pdf.ts'

async function pdfOf(encrypting: Parameters<PDFDocument['encrypt']>[0] | undefined) {
  const pdf = await PDFDocument.create()
  pdf.addPage()
  pdf.addPage()
  if (encrypting !== undefined) pdf.encrypt(encrypting)
  return pdf.save()
}

describe('loadedPdf', () => {
  it('reads a PDF that no password protects', async () => {
    expect((await loadedPdf(await pdfOf(undefined))).getPageCount()).toBe(2)
  })

  it('reads a PDF that opens without a password, though one restricts it', async () => {
    const restricted = await pdfOf({ userPassword: '', ownerPassword: 'owner' })
    await expect(PDFDocument.load(restricted)).rejects.toThrow(/encrypted/)
    expect((await loadedPdf(restricted)).getPageCount()).toBe(2)
  })

  it('rejects a PDF that needs a password to open', async () => {
    const secret = await pdfOf({ userPassword: 'secret', ownerPassword: 'owner' })
    await expect(loadedPdf(secret)).rejects.toThrow(/password/i)
  })

  it('keeps the options it is given', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage()
    pdf.setProducer('Another producer')
    const content = await pdf.save({ updateFieldAppearances: false })
    const kept = await loadedPdf(content, { updateMetadata: false })
    expect(kept.getProducer()).toBe('Another producer')
  })
})
