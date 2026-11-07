import { readFileSync } from 'node:fs'
import fontkit from '@cantoo/fontkit'
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  type PDFPage,
  PDFRawStream,
  PDFRef,
  StandardFonts,
} from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { Amount } from '../domain/amount.ts'
import { CalendarDate } from '../domain/calendar-date.ts'
import { Document } from '../domain/document.ts'
import { Expense } from '../domain/expense.ts'
import { Kind } from '../domain/kind.ts'
import { layoutOf } from '../domain/layout.ts'
import { Report } from '../domain/report.ts'
import { paletteFrom } from './palette.ts'
import { wrap, writeReportDocument } from './write-report-document.ts'

const tokens = new Map(
  [...readFileSync('src/style.css', 'utf8').matchAll(/(--mac-[a-z-]+):\s*([^;]+);/g)].map(
    (match) => [match[1] ?? '', match[2] ?? ''],
  ),
)
const palette = paletteFrom((token) => tokens.get(token) ?? '')

async function pdfOf(pageSizes: [number, number][], text: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (const size of pageSizes) {
    pdf.addPage(size).drawText(text, { x: 50, y: 50, size: 12, font })
  }
  return pdf.save()
}

const png = new Uint8Array(readFileSync('src/assets/mcscert-left-col.png'))

async function reportOf(description: string): Promise<Report> {
  const receipt = new Document(
    Kind.receipt,
    'air-canada.pdf',
    await pdfOf(
      [
        [595, 842],
        [595, 842],
      ],
      'Boarding',
    ),
  )
  const statement = new Document(Kind.bankStatement, 'statement-octobre.png', png)
  return new Report({
    claimantName: 'Zoë Łukasiewicz',
    position: 'Faculty',
    email: 'zoe@mcmaster.ca',
    event: 'ICSE 2026',
    firstDay: new CalendarDate(2026, 10, 3),
    lastDay: new CalendarDate(2026, 10, 7),
    account: '20-123-456',
  }).afterAdding(
    new Expense({
      date: new CalendarDate(2026, 10, 3),
      description,
      claimedAmount: new Amount(101235),
      receipts: [receipt],
      bankStatements: [statement],
    }),
  )
}

async function written(report: Report): Promise<PDFDocument> {
  const bytes = await writeReportDocument({
    layout: layoutOf(report),
    palette,
    version: '0.1.0',
    writtenOn: new CalendarDate(2026, 11, 7),
  })
  return PDFDocument.load(bytes, { updateMetadata: false })
}

/** The texts a page shows, read back through each font's ToUnicode map. */
function textsOf(pdf: PDFDocument, page: PDFPage): string[] {
  const context = pdf.context
  const decode = (object: unknown) =>
    object instanceof PDFRawStream
      ? new TextDecoder('latin1').decode(decodePDFRawStream(object).decode())
      : ''
  const fonts = new Map<string, Map<number, string>>()
  const fontDict = page.node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict)
  for (const [name, reference] of fontDict?.entries() ?? []) {
    const font = context.lookup(reference, PDFDict)
    const cmap = decode(font.lookup(PDFName.of('ToUnicode')))
    const glyphs = new Map<number, string>()
    const unicode = (hex: string) =>
      String.fromCharCode(...(hex.match(/.{4}/g) ?? []).map((part) => Number.parseInt(part, 16)))
    for (const [, glyph, text] of cmap.matchAll(/^<([0-9A-Fa-f]+)> *<([0-9A-Fa-f]+)>$/gm)) {
      glyphs.set(Number.parseInt(glyph ?? '', 16), unicode(text ?? ''))
    }
    for (const [, from, to, text] of cmap.matchAll(
      /^<([0-9A-Fa-f]+)> *<([0-9A-Fa-f]+)> *<([0-9A-Fa-f]+)>$/gm,
    )) {
      const start = Number.parseInt(from ?? '', 16)
      const base = Number.parseInt(text ?? '', 16)
      for (let glyph = start; glyph <= Number.parseInt(to ?? '', 16); glyph += 1) {
        glyphs.set(glyph, String.fromCharCode(base + glyph - start))
      }
    }
    fonts.set(name.asString(), glyphs)
  }
  const contents = page.node.get(PDFName.of('Contents'))
  const references =
    contents instanceof PDFRef ? [contents] : (context.lookup(contents, PDFArray)?.asArray() ?? [])
  const streams = references.flatMap((reference) => {
    const object = context.lookup(reference)
    return object instanceof PDFArray
      ? object.asArray().map((ref) => context.lookup(ref))
      : [object]
  })
  const texts: string[] = []
  let glyphs: Map<number, string> | undefined
  for (const stream of streams) {
    for (const [, font, hex] of decode(stream).matchAll(/(\/\S+) [\d.]+ Tf|<([0-9A-Fa-f]*)> Tj/g)) {
      if (font !== undefined) {
        glyphs = fonts.get(font)
      } else if (glyphs !== undefined && glyphs.size > 0) {
        const codes = (hex ?? '').match(/.{4}/g) ?? []
        texts.push(codes.map((code) => glyphs?.get(Number.parseInt(code, 16)) ?? '?').join(''))
      } else {
        const codes = (hex ?? '').match(/.{2}/g) ?? []
        texts.push(codes.map((code) => String.fromCharCode(Number.parseInt(code, 16))).join(''))
      }
    }
  }
  return texts
}

describe('writeReportDocument', () => {
  it('writes the cover, then each section, its section page and its documents', async () => {
    const pdf = await written(await reportOf('Air Canada, YYZ–CDG return'))
    const pages = pdf.getPages()
    expect(pages).toHaveLength(6)
    const [cover, receipts, boarding, pass, statements, statement] = pages.map((page) =>
      textsOf(pdf, page),
    )
    expect(cover).toEqual(
      expect.arrayContaining([
        'McSCert Expense Report',
        '2026-11-07',
        'Name of claimant',
        'Zoë Łukasiewicz',
        'Dates of the event',
        '2026-10-03 to 2026-10-07',
        'Receipts  R1',
        'Bank statements  S1',
        'Missing receipt authorizations',
        'Air Canada, YYZ–CDG return',
        '$1,012.35',
        'R1, S1',
        'Total',
        '1 / 6',
      ]),
    )
    expect(receipts).toEqual(
      expect.arrayContaining(['Receipts', 'R1', 'air-canada.pdf', '3–4', '1', '2 / 6']),
    )
    expect(boarding).toEqual(['Boarding', 'R1 · Expense 1 · 3 / 6'])
    expect(pass).toEqual(['Boarding', 'R1 · Expense 1 · 4 / 6'])
    expect(statements).toEqual(
      expect.arrayContaining(['Bank statements', 'S1', 'statement-octobre.png', '6', '5 / 6']),
    )
    expect(statement).toEqual(['S1 · Expense 1 · 6 / 6'])
  })

  it('keeps every page of a PDF document as it is, and places an image on a Letter page that matches it', async () => {
    const pdf = await written(await reportOf('Taxi'))
    const sizes = pdf.getPages().map((page) => [page.getWidth(), page.getHeight()])
    expect(sizes).toEqual([
      [612, 792],
      [612, 792],
      [595, 842],
      [595, 842],
      [612, 792],
      [792, 612],
    ])
  })

  it("names the document after the event, the claimant and the system's version", async () => {
    const pdf = await written(await reportOf('Taxi'))
    expect(pdf.getTitle()).toBe('McSCert Expense Report — ICSE 2026')
    expect(pdf.getAuthor()).toBe('Zoë Łukasiewicz')
    expect(pdf.getCreator()).toBe('McSCert Expense Report v0.1.0')
  })

  it('continues the table of expenses on the next page, its header repeated, never clipping a description', async () => {
    const attendees = Array.from({ length: 160 }, (_, index) => `Attendee ${index + 1} (McMaster)`)
    const pdf = await written(await reportOf(`Dinner with ${attendees.join(', ')}`))
    const covers = pdf
      .getPages()
      .map((page) => textsOf(pdf, page))
      .filter((texts) => !texts.some((text) => text.includes('·')) && !texts.includes('Receipts'))
      .filter((texts) => texts.includes('Description'))
    expect(covers.length).toBeGreaterThan(1)
    const text = covers.flat().join(' ')
    expect(text).toContain('Attendee 160 (McMaster)')
    expect(text).toContain('Total')
  })
})

describe('wrap', () => {
  it('breaks a text at spaces, and a word longer than the width', async () => {
    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    expect(wrap('one two three', font, 10, 40)).toEqual(['one two', 'three'])
    expect(wrap('', font, 10, 40)).toEqual([''])
    expect(wrap('first\nsecond', font, 10, 200)).toEqual(['first', 'second'])
    const pieces = wrap('Supercalifragilisticexpialidocious', font, 10, 40)
    expect(pieces.length).toBeGreaterThan(1)
    expect(pieces.join('')).toBe('Supercalifragilisticexpialidocious')
  })
})
