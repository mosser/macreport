import { readFileSync } from 'node:fs'
import fontkit from '@cantoo/fontkit'
import {
  decodePDFRawStream,
  degrees,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  type PDFPage,
  PDFRawStream,
  PDFRef,
  PDFString,
  StandardFonts,
} from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { Amount } from '../domain/amount.ts'
import { CalendarDate } from '../domain/calendar-date.ts'
import { Currency } from '../domain/currency.ts'
import { Document } from '../domain/document.ts'
import { Expense } from '../domain/expense.ts'
import { Kind } from '../domain/kind.ts'
import { layoutOf } from '../domain/layout.ts'
import { Meal } from '../domain/meal.ts'
import { MissingReceipt } from '../domain/missing-receipt.ts'
import { PerDiem } from '../domain/per-diem.ts'
import { type PolicyDocument, policy } from '../domain/policy.ts'
import { Report } from '../domain/report.ts'
import { DocumentsAsWritten } from './documents-as-written.ts'
import { wrap } from './generated-page.ts'
import type { ImageEncoder } from './image-encoder.ts'
import { paletteFrom } from './palette.ts'
import { writeReportDocument } from './write-report-document.ts'

/** The documents of these tests are small: nothing is encoded again. */
const neverEncoding: ImageEncoder = {
  jpeg: async () => {
    throw new RangeError('An image too small to reduce was encoded')
  },
  png: async () => {
    throw new RangeError('An image too small to reduce was encoded')
  },
}

const tokens = new Map(
  [...readFileSync('src/style.css', 'utf8').matchAll(/(--mac-[a-z-]+):([^;]*);/g)].map((match) => [
    match[1] ?? '',
    (match[2] ?? '').trim(),
  ]),
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

/** A JPEG header of a width and a height, with an Exif orientation when given: enough to embed. */
function jpegOf(width: number, height: number, orientation?: number): Uint8Array {
  const bytes = [0xff, 0xd8]
  if (orientation !== undefined) {
    const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1]
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff, 0, orientation, 0, 0, 0, 0, 0, 0]
    bytes.push(0xff, 0xe1, 0, exif.length + 2, ...exif)
  }
  bytes.push(
    0xff,
    0xc0,
    0,
    11,
    8,
    ...[height, width].flatMap((value) => [value >> 8, value & 0xff]),
  )
  bytes.push(1, 1, 0x11, 0, 0xff, 0xd9)
  return new Uint8Array(bytes)
}

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
    purpose: 'ICSE 2026',
    accountName: '20-123-456',
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
    documents: new DocumentsAsWritten(neverEncoding),
  })
  return PDFDocument.load(bytes, { updateMetadata: false })
}

/** The text of a stream, its bytes read one character each. */
function decoded(object: unknown): string {
  return object instanceof PDFRawStream
    ? new TextDecoder('latin1').decode(decodePDFRawStream(object).decode())
    : ''
}

/** The characters a hexadecimal string of four digits a character writes. */
function unicode(hex: string): string {
  return String.fromCharCode(...(hex.match(/.{4}/g) ?? []).map((part) => Number.parseInt(part, 16)))
}

/** The character of each glyph of a font, from its ToUnicode map. */
function glyphsOf(cmap: string): Map<number, string> {
  const glyphs = new Map<number, string>()
  for (const [, glyph, text] of cmap.matchAll(/^<([0-9A-Fa-f]+)> ?<([0-9A-Fa-f]+)>$/gm)) {
    glyphs.set(Number.parseInt(glyph ?? '', 16), unicode(text ?? ''))
  }
  for (const [, from, to, text] of cmap.matchAll(
    /^<([0-9A-Fa-f]+)> ?<([0-9A-Fa-f]+)> ?<([0-9A-Fa-f]+)>$/gm,
  )) {
    const start = Number.parseInt(from ?? '', 16)
    const base = Number.parseInt(text ?? '', 16)
    for (let glyph = start; glyph <= Number.parseInt(to ?? '', 16); glyph += 1) {
      glyphs.set(glyph, String.fromCharCode(base + glyph - start))
    }
  }
  return glyphs
}

/** The glyphs of each font of a page, by the font's name in its content. */
function fontsOf(pdf: PDFDocument, page: PDFPage): Map<string, Map<number, string>> {
  const fonts = new Map<string, Map<number, string>>()
  const fontDict = page.node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict)
  for (const [name, reference] of fontDict?.entries() ?? []) {
    const font = pdf.context.lookup(reference, PDFDict)
    fonts.set(name.asString(), glyphsOf(decoded(font.lookup(PDFName.of('ToUnicode')))))
  }
  return fonts
}

/** The content streams of a page, in order. */
function streamsOf(pdf: PDFDocument, page: PDFPage): unknown[] {
  const context = pdf.context
  const contents = page.node.get(PDFName.of('Contents'))
  const references =
    contents instanceof PDFRef ? [contents] : (context.lookup(contents, PDFArray)?.asArray() ?? [])
  return references.flatMap((reference) => {
    const object = context.lookup(reference)
    return object instanceof PDFArray
      ? object.asArray().map((ref) => context.lookup(ref))
      : [object]
  })
}

/** A string a page shows: glyphs read through the font's map, or bytes of a standard font. */
function textOf(hex: string, glyphs: Map<number, string> | undefined): string {
  if (glyphs !== undefined && glyphs.size > 0) {
    const codes = hex.match(/.{4}/g) ?? []
    return codes.map((code) => glyphs.get(Number.parseInt(code, 16)) ?? '?').join('')
  }
  const codes = hex.match(/.{2}/g) ?? []
  return codes.map((code) => String.fromCharCode(Number.parseInt(code, 16))).join('')
}

/** The texts a page shows, read back through each font's ToUnicode map. */
function textsOf(pdf: PDFDocument, page: PDFPage): string[] {
  const fonts = fontsOf(pdf, page)
  const texts: string[] = []
  let glyphs: Map<number, string> | undefined
  for (const stream of streamsOf(pdf, page)) {
    for (const [, font, hex] of decoded(stream).matchAll(
      /(\/[\w+-]+) [\d.]+ Tf|<([0-9A-Fa-f]*)> Tj/g,
    )) {
      if (font === undefined) {
        texts.push(textOf(hex ?? '', glyphs))
      } else {
        glyphs = fonts.get(font)
      }
    }
  }
  return texts
}

/** The texts of a page, each line of a stamp as one: its pieces are written one by one, around their arrows. */
function stampedTextsOf(pdf: PDFDocument, page: PDFPage): string[] {
  const texts: string[] = []
  let isJoining = false
  for (const text of textsOf(pdf, page)) {
    if (text === ' · ' || isJoining) {
      texts[texts.length - 1] += text
      isJoining = text === ' · '
    } else {
      texts.push(text)
    }
  }
  return texts
}

/** Where a page shows each text it writes: the text, read back, and where its baseline starts. */
function placesOf(pdf: PDFDocument, page: PDFPage) {
  const fonts = fontsOf(pdf, page)
  const places: { text: string; x: number; y: number }[] = []
  let glyphs: Map<number, string> | undefined
  let at = { x: 0, y: 0 }
  for (const stream of streamsOf(pdf, page)) {
    for (const [, font, x, y, hex] of decoded(stream).matchAll(
      /(\/[\w+-]+) [\d.]+ Tf|1 0 0 1 ([\d.-]+) ([\d.-]+) Tm|<([0-9A-Fa-f]*)> Tj/g,
    )) {
      if (font !== undefined) glyphs = fonts.get(font)
      else if (x !== undefined) at = { x: Number(x), y: Number(y) }
      else places.push({ text: textOf(hex ?? '', glyphs), ...at })
    }
  }
  return places
}

/** The links of a page: the number of the page each goes to, how, and where it is clicked. */
function linksOf(pdf: PDFDocument, page: PDFPage) {
  const references = pdf.getPages().map((each) => each.ref.toString())
  const annotations = (page.node.Annots()?.asArray() ?? [])
    .map((reference) => pdf.context.lookup(reference, PDFDict))
    .filter((annotation) => annotation.get(PDFName.of('Subtype')) === PDFName.of('Link'))
    .filter((annotation) => annotation.has(PDFName.of('Dest')))
  return annotations.map((annotation) => {
    const destination = annotation.lookup(PDFName.of('Dest'), PDFArray)
    const top = destination.lookupMaybe(3, PDFNumber)?.asNumber()
    const [left = 0, bottom = 0, right = 0] = annotation
      .lookup(PDFName.of('Rect'), PDFArray)
      .asArray()
      .map((value) => (value as PDFNumber).asNumber())
    return {
      to: references.indexOf(destination.get(0)?.toString() ?? '') + 1,
      how: destination.lookup(1, PDFName).asString(),
      ...(top === undefined ? {} : { top }),
      left,
      bottom,
      width: right - left,
    }
  })
}

/** The size a page shows with on screen, its rotation taken into account. */
function shown(page: PDFPage): number[] {
  const isSideways = page.getRotation().angle % 180 !== 0
  const [width, height] = [page.getWidth(), page.getHeight()]
  return isSideways ? [height, width] : [width, height]
}

describe('writeReportDocument', () => {
  it("links each document of an expense's row to its first page, and each page of a document back to the row", async () => {
    const pdf = await written(await reportOf('Air Canada, YYZ–CDG return'))
    const pages = pdf.getPages()
    const [cover, , boarding, pass, , statement] = pages.map((page) => linksOf(pdf, page))
    expect(cover?.map(({ to, how }) => [to, how])).toEqual([
      [3, '/Fit'],
      [6, '/Fit'],
    ])
    expect(cover?.[0]?.left).toBeLessThan(cover?.[1]?.left ?? 0)
    expect(cover?.[0]?.bottom).toBe(cover?.[1]?.bottom)
    expect(cover?.[0]?.left).toBeCloseTo(54 + 22 + 62 + 4)
    for (const links of [boarding, pass, statement]) {
      expect(links?.map(({ to, how }) => [to, how])).toEqual([[1, '/XYZ']])
    }
    const row = boarding?.[0]?.top ?? 0
    expect(row).toBeGreaterThan(54)
    expect(row).toBeLessThan(792 - 54)
    expect(statement?.[0]?.top).toBe(row)
    expect(boarding?.[0]?.width).toBeGreaterThan(120)
  })

  it('links the label of a stamp to its section page only for a document with no expense to go back to', async () => {
    const report = await reportOf('Air Canada, YYZ–CDG return')
    const pdf = await written(
      report.afterChanging({
        additionalDocuments: [new Document(Kind.additionalDocument, 'invitation.png', png)],
      }),
    )
    const [invitation, boarding] = [2, 4].map((index) => linksOf(pdf, pdf.getPage(index)))
    expect(invitation?.map(({ to, how }) => [to, how])).toEqual([[2, '/XYZ']])
    expect(boarding?.map(({ to, how }) => [to, how])).toEqual([[1, '/XYZ']])
  })

  it('links a label and its pages on a section page to the first page of the document', async () => {
    const pdf = await written(await reportOf('Air Canada, YYZ–CDG return'))
    const [label, pages, expense] = linksOf(pdf, pdf.getPage(1))
    expect([label?.to, label?.how]).toEqual([3, '/Fit'])
    expect([pages?.to, pages?.how]).toEqual([3, '/Fit'])
    expect([expense?.to, expense?.how]).toEqual([1, '/XYZ'])
  })

  it('marks every link of a stamp with an arrow of three strokes, and nothing else', async () => {
    const report = await reportOf('Air Canada, YYZ–CDG return')
    const pdf = await written(
      report.afterChanging({
        additionalDocuments: [new Document(Kind.additionalDocument, 'invitation.png', png)],
      }),
    )
    const strokes = (page: PDFPage) =>
      streamsOf(pdf, page)
        .map((stream) => decoded(stream).match(/\bl\s+S\b/g)?.length ?? 0)
        .reduce((sum, count) => sum + count, 0)
    const invitation = pdf
      .getPages()
      .find((page) => stampedTextsOf(pdf, page).at(-1)?.startsWith('A1'))
    const statement = pdf.getPages().at(-1)
    if (invitation === undefined || statement === undefined) throw new TypeError('No page')
    expect(strokes(invitation)).toBe(3)
    expect(strokes(statement)).toBe(3)
  })

  it('makes a link wide enough to click its arrow too', async () => {
    const pdf = await written(await reportOf('Air Canada, YYZ–CDG return'))
    const [receipt, statement] = linksOf(pdf, pdf.getPage(0))
    const places = placesOf(pdf, pdf.getPage(0))
    const separator = places.find((place) => place.text === ' · ')
    expect(places.some((place) => place.text === 'Receipt')).toBe(true)
    expect(places.some((place) => place.text === 'Statement')).toBe(true)
    // The link of the receipt ends where the separator after its arrow starts.
    expect((receipt?.left ?? 0) + (receipt?.width ?? 0)).toBeCloseTo(separator?.x ?? 0)
    expect(statement?.width).toBeGreaterThan(receipt?.width ?? 0)
  })

  it('puts the expenses of a stamp too wide for its page on lines of their own, above it', async () => {
    const report = await reportOf('Taxi 1')
    const expense = report.expenses[0]
    if (expense === undefined) throw new TypeError('No expense')
    const others = Array.from({ length: 7 }, (_, index) =>
      expense.afterChanging({ description: `Taxi ${index + 2}` }),
    )
    const pdf = await written(others.reduce((each, other) => each.afterAdding(other), report))
    const boarding = pdf.getPage(2)
    const [content, base, ...expenseLines] = stampedTextsOf(pdf, boarding)
    expect([content, base]).toEqual(['Boarding', 'R1 · 3 / 6'])
    expect(expenseLines.toReversed()).toEqual(
      Array.from({ length: 8 }, (_, index) => `Expense ${index + 1}: Taxi ${index + 1}`),
    )
    const links = linksOf(pdf, boarding)
    expect(links.map(({ to, how }) => [to, how])).toEqual(expenseLines.map(() => [1, '/XYZ']))
    const crop = boarding.getCropBox()
    for (const link of links) {
      expect(link.left).toBeGreaterThanOrEqual(crop.x)
      expect(link.left + link.width).toBeLessThanOrEqual(crop.x + crop.width)
    }
  })

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
        'Receipts',
        'Bank statements',
        'Missing receipt authorizations',
        'Additional documents',
        'Air Canada, YYZ–CDG return',
        '$1,012.35',
        'Receipt',
        'Statement',
        'Entered',
        'Total',
        '1 / 6',
      ]),
    )
    expect(receipts).toEqual(
      expect.arrayContaining([
        'Receipts',
        'Name',
        'Expenses',
        'R1',
        'air-canada',
        '3–4',
        'Air Canada, YYZ–CDG return',
        '2 / 6',
      ]),
    )
    expect(receipts).not.toContain('1')
    const stamps = pdf.getPages().map((page) => stampedTextsOf(pdf, page))
    expect(stamps[2]).toEqual(['Boarding', 'R1 · Expense 1: Air Canada, YYZ–CDG return · 3 / 6'])
    expect(stamps[3]).toEqual(['Boarding', 'R1 · Expense 1: Air Canada, YYZ–CDG return · 4 / 6'])
    expect(boarding).toHaveLength(pass?.length ?? 0)
    expect(statements).toEqual(
      expect.arrayContaining([
        'Bank statements',
        'S1',
        'statement-octobre',
        '6',
        'Air Canada, YYZ–CDG return',
        '5 / 6',
      ]),
    )
    expect(stamps[5]).toEqual(['S1 · Expense 1: Air Canada, YYZ–CDG return · 6 / 6'])
    expect(statement?.at(0)).toBe('S1')
  })

  it('opens with the additional documents, travel justifications first, closes with the bank statements, and calls each document by its name', async () => {
    const invitation = new Document(Kind.additionalDocument, 'invitation.png', png)
    const itinerary = new Document(
      Kind.additionalDocument,
      'itinerary.pdf',
      await pdfOf([[612, 792]], 'Itinerary'),
    )
    const report = await reportOf('Air Canada, YYZ–CDG return')
    const statement = report.expenses[0]?.bankStatements[0]
    if (statement === undefined) throw new TypeError('No bank statement')
    const travel = report
      .afterChanging({
        isBusinessTravel: true,
        firstDay: new CalendarDate(2026, 10, 3),
        lastDay: new CalendarDate(2026, 10, 7),
        locations: 'Rio de Janeiro, Brazil',
        travelJustifications: [invitation],
        additionalDocuments: [itinerary],
      })
      .afterRenaming(statement, 'Visa, October')
      .afterRenaming(invitation, 'Invitation from ICSE')
    const pdf = await written(travel)
    const texts = pdf.getPages().map((page) => textsOf(pdf, page))
    expect(texts).toHaveLength(9)
    const [cover, additional, justification, itineraryPage, receipts, , , statements, last] = texts
    expect(cover).toEqual(expect.arrayContaining(['Receipt', 'Statement', '1 / 9']))
    expect(cover).not.toContain('Visa, October')
    expect(additional).toEqual(
      expect.arrayContaining([
        'Additional documents',
        'Name',
        'A1',
        'Invitation from ICSE',
        '3',
        'A2',
        'itinerary',
        '4',
      ]),
    )
    expect(additional).not.toContain('Expenses')
    const at = (text: string, from = 0) => additional?.indexOf(text, from) ?? -1
    const others = at('Other documents')
    expect(at('Travel justifications')).toBeGreaterThan(at('Additional documents'))
    expect(at('A1')).toBeGreaterThan(at('Travel justifications'))
    expect(others).toBeGreaterThan(at('A1'))
    expect(at('A2')).toBeGreaterThan(others)
    const stamps = pdf.getPages().map((page) => stampedTextsOf(pdf, page))
    expect(stamps[2]).toEqual(['A1 · Invitation from ICSE · 3 / 9'])
    expect(stamps[3]).toEqual(['Itinerary', 'A2 · itinerary · 4 / 9'])
    expect(justification?.at(0)).toBe('A1')
    expect(itineraryPage?.at(0)).toBe('Itinerary')
    expect(receipts).toEqual(expect.arrayContaining(['Receipts', 'R1']))
    expect(statements).toEqual(expect.arrayContaining(['Bank statements', 'S1', 'Visa, October']))
    expect(stamps[8]).toEqual(['S1 · Expense 1: Air Canada, YYZ–CDG return · 9 / 9'])
    expect(last?.at(0)).toBe('S1')
  })

  it('gives each expense an Entered box on the cover, empty, which needs no font of its own', async () => {
    const report = await reportOf('Air Canada, YYZ–CDG return')
    const taxi = new Expense({
      date: new CalendarDate(2026, 10, 5),
      description: 'Taxi',
      claimedAmount: new Amount(8710),
      receipts: report.expenses[0]?.receipts ?? [],
      bankStatements: report.expenses[0]?.bankStatements ?? [],
    })
    const pdf = await written(report.afterAdding(taxi))
    const boxes = pdf.getForm().getFields()
    expect(boxes.map((box) => box.getName())).toEqual(['Entered, expense 1', 'Entered, expense 2'])
    const cover = pdf.getPage(0).ref
    for (const box of boxes) {
      const checkBox = pdf.getForm().getCheckBox(box.getName())
      expect(checkBox.isChecked()).toBe(false)
      expect(checkBox.acroField.getWidgets()[0]?.P()).toBe(cover)
    }
    const acroForm = pdf.catalog.lookup(PDFName.of('AcroForm'), PDFDict)
    expect(acroForm.get(PDFName.of('DR'))).toBeUndefined()
  })

  it("names an expense's documents on a line under it, from under its description", async () => {
    const pdf = await written(await reportOf('Air Canada, YYZ–CDG return'))
    const places = placesOf(pdf, pdf.getPage(0))
    const at = (text: string) => places.find((place) => place.text === text)
    expect(at('Supporting documents')).toBeUndefined()
    const [description, receipt, separator, statement] = [
      'Air Canada, YYZ–CDG return',
      'Receipt',
      ' · ',
      'Statement',
    ].map(at)
    expect(receipt?.x).toBeCloseTo(description?.x ?? 0)
    expect(receipt?.y).toBeLessThan(description?.y ?? 0)
    expect([separator?.y, statement?.y]).toEqual([receipt?.y, receipt?.y])
    expect(statement?.x).toBeGreaterThan(separator?.x ?? 0)
  })

  it('names the expenses a document supports on its section page by their description, each a link to its row', async () => {
    const report = await reportOf('Air Canada, YYZ–CDG return')
    const expense = report.expenses[0]
    if (expense === undefined) throw new TypeError('No expense')
    const dinner = expense.afterChanging({
      date: new CalendarDate(2026, 10, 5),
      description: 'Dinner with the programme committee of ICSE',
    })
    const pdf = await written(report.afterAdding(dinner))
    const statements = pdf.getPage(4)
    const places = placesOf(pdf, statements)
    const [flight, meal] = ['Air Canada, YYZ–CDG return', 'Dinner with the programme comm…'].map(
      (text) => places.find((place) => place.text === text),
    )
    expect(flight?.x).toBe(meal?.x)
    expect(meal?.y).toBeLessThan(flight?.y ?? 0)
    const links = linksOf(pdf, statements).filter(({ to }) => to === 1)
    expect(links.map(({ to, how }) => [to, how])).toEqual([
      [1, '/XYZ'],
      [1, '/XYZ'],
    ])
    expect(links[0]?.top).toBeGreaterThan(links[1]?.top ?? 0)
  })

  it('keeps the line breaks of a description on the cover, and none in a stamp', async () => {
    const pdf = await written(await reportOf('Dinner with:\nAda Lovelace (McMaster)'))
    const places = placesOf(pdf, pdf.getPage(0))
    const [first, second] = ['Dinner with:', 'Ada Lovelace (McMaster)'].map((text) =>
      places.find((place) => place.text === text),
    )
    expect(second?.x).toBe(first?.x)
    expect(second?.y).toBeLessThan(first?.y ?? 0)
    expect(stampedTextsOf(pdf, pdf.getPage(2)).at(-1)).toBe(
      'R1 · Expense 1: Dinner with: Ada Lovelace (McM… · 3 / 6',
    )
  })

  it('writes the foreign amounts, and the total one amount per line', async () => {
    const report = await reportOf('Air Canada, YYZ–CDG return')
    const flight = report.expenses[0] ?? new Expense()
    const taxi = flight.afterChanging({
      description: 'Taxi, CDG–hotel',
      claimedAmount: undefined,
      isPaidInAnotherCurrency: true,
      foreignAmount: new Amount(5500),
      currency: Currency.parse('EUR'),
    })
    const pdf = await written(report.afterAdding(taxi))
    const places = placesOf(pdf, pdf.getPage(0))
    const place = (text: string) => places.find((each) => each.text === text)
    expect(place('EUR 55.00')).toBeDefined()
    const [cad, euro] = [place('CAD'), place('EUR')]
    expect(euro?.x).toBe(cad?.x)
    expect(euro?.y).toBeLessThan(cad?.y ?? 0)
    expect(place('Total')?.y).toBe(cad?.y)
    // Right-aligned: digits are of one width in Noto Sans, so the shorter amount starts further on.
    expect(place('1,012.35')?.y).toBe(cad?.y)
    expect(place('55.00')?.y).toBe(euro?.y)
    expect(place('55.00')?.x).toBeGreaterThan(place('1,012.35')?.x ?? 0)
  })

  it('writes the titles of the last columns of the cover on two lines, each centred in its column', async () => {
    const pdf = await written(await reportOf('Air Canada, YYZ–CDG return'))
    const places = placesOf(pdf, pdf.getPage(0))
    const at = (text: string) => places.find((place) => place.text === text)
    const [claimed, currency, entered, mosaic] = ['Claimed', '(CAD)', 'Entered', '(Mosaic)'].map(at)
    expect(currency?.y).toBeLessThan(claimed?.y ?? 0)
    expect(mosaic?.y).toBe(currency?.y)
    expect(entered?.y).toBe(claimed?.y)
    // The shorter line of each title starts further on, and neither leaves its column.
    const claimedColumn = 54 + 22 + 62 + 220 + 76
    expect(currency?.x).toBeGreaterThan(claimed?.x ?? 0)
    expect(claimed?.x).toBeGreaterThan(claimedColumn)
    expect(claimed?.x).toBeLessThan(claimedColumn + 76 / 2)
    const enteredColumn = claimedColumn + 76
    expect(entered?.x).toBeGreaterThan(mosaic?.x ?? 0)
    expect(mosaic?.x).toBeGreaterThanOrEqual(enteredColumn)
    expect(mosaic?.x).toBeLessThan(enteredColumn + 48 / 2)
  })

  it('writes the claimed amounts on the right of their column, ending with those of the total', async () => {
    const report = await reportOf('Air Canada, YYZ–CDG return')
    const flight = report.expenses[0] ?? new Expense()
    const pdf = await written(
      report.afterAdding(flight.afterChanging({ claimedAmount: new Amount(1000) })),
    )
    const places = placesOf(pdf, pdf.getPage(0))
    const at = (text: string) => places.find((place) => place.text === text)
    const [large, small, total] = [at('$1,012.35'), at('$10.00'), at('1,022.35')]
    expect(small?.x).toBeGreaterThan(large?.x ?? 0)
    // Bold digits are of one width too: the same text ends at the same place in either font.
    const column = 54 + 22 + 62 + 220 + 76
    expect(large?.x).toBeGreaterThan(column + 4)
    expect(total?.x).toBeGreaterThan(large?.x ?? 0)
  })

  describe('the Policy section', () => {
    const [first, second] = policy.documents
    if (first === undefined || second === undefined) throw new TypeError('No policy')

    /** The cover of a report whose policy holds the documents given. */
    async function coverWith(documents: readonly PolicyDocument[]) {
      const report = await reportOf('Air Canada, YYZ–CDG return')
      const bytes = await writeReportDocument({
        layout: { ...layoutOf(report), policyDocuments: documents },
        palette,
        version: '0.1.0',
        writtenOn: new CalendarDate(2026, 11, 7),
        documents: new DocumentsAsWritten(neverEncoding),
      })
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false })
      return { pdf, places: placesOf(pdf, pdf.getPage(0)) }
    }

    it('stands level with the attached information, against the right margin', async () => {
      const { places } = await coverWith(policy.documents)
      const at = (text: string) => places.find((place) => place.text === text)
      expect(at('Policy')?.y).toBe(at('Attached information')?.y)
      expect(at(first.name)?.y).toBe(at('Additional documents')?.y)
      expect(at(second.name)?.y).toBe(at('Bank statements')?.y)
      expect(at('Policy')?.x).toBeGreaterThan(400)
      // Each name ends at the same place: the longer one starts earlier.
      expect(at(second.name)?.x).toBeLessThan(at(first.name)?.x ?? 0)
      expect(at('Expenses')?.y).toBeLessThan(at('Receipts')?.y ?? 0)
    })

    it('links each name to its address, its arrow included, within the right margin', async () => {
      const { pdf } = await coverWith(policy.documents)
      const links = (pdf.getPage(0).node.Annots()?.asArray() ?? [])
        .map((reference) => pdf.context.lookup(reference, PDFDict))
        .filter((annotation) => annotation.has(PDFName.of('A')))
      const actions = links.map((link) => link.lookup(PDFName.of('A'), PDFDict))
      expect(actions.map((action) => action.get(PDFName.of('S')))).toEqual([
        PDFName.of('URI'),
        PDFName.of('URI'),
      ])
      expect(
        actions.map((action) => action.lookup(PDFName.of('URI'), PDFString).asString()),
      ).toEqual(policy.documents.map(({ url }) => url))
      for (const link of links) {
        const [left = 0, , right = 0] = link
          .lookup(PDFName.of('Rect'), PDFArray)
          .asArray()
          .map((value) => (value as PDFNumber).asNumber())
        expect(right).toBeCloseTo(612 - 54)
        expect(left).toBeGreaterThan(612 - 54 - 290 - 10)
      }
    })

    it('wraps a long name clear of the attached information', async () => {
      const name = Array.from({ length: 12 }, () => 'Reimbursements').join(' ')
      const { places } = await coverWith([{ name, url: first.url }])
      const lines = places.filter((place) => place.text.startsWith('Reimbursements'))
      expect(lines.length).toBeGreaterThan(1)
      const widest = places.find((place) => place.text === 'Missing receipt authorizations')
      for (const line of lines) {
        expect(line.x).toBeGreaterThan((widest?.x ?? 0) + 150)
      }
    })

    it('continues on the next page when it is longer than a page, under the attached information', async () => {
      const documents = Array.from({ length: 70 }, (_, index) => ({
        name: `Document ${index + 1}`,
        url: first.url,
      }))
      const report = await reportOf('Air Canada, YYZ–CDG return')
      const bytes = await writeReportDocument({
        layout: { ...layoutOf(report), policyDocuments: documents },
        palette,
        version: '0.1.0',
        writtenOn: new CalendarDate(2026, 11, 7),
        documents: new DocumentsAsWritten(neverEncoding),
      })
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false })
      const pages = pdf.getPages().map((page) => placesOf(pdf, page))
      const written = pages.flat().filter((place) => place.text.startsWith('Document '))
      expect(new Set(written.map((place) => place.text)).size).toBe(70)
      for (const place of written) {
        expect(place.y).toBeGreaterThanOrEqual(54)
      }
      const onFirst = pages[0]?.filter((place) => place.text.startsWith('Document ')) ?? []
      const on = (text: string) => pages[0]?.find((place) => place.text === text)
      expect(on('Policy')?.y).toBeLessThan(on('Receipts')?.y ?? 0)
      expect(onFirst.length).toBeLessThan(70)
      const links = (pdf.getPage(1).node.Annots()?.asArray() ?? [])
        .map((reference) => pdf.context.lookup(reference, PDFDict))
        .filter((annotation) => annotation.has(PDFName.of('A')))
      expect(links.length).toBeGreaterThan(0)
      expect(pages.flat().some((place) => place.text === 'Expenses')).toBe(true)
    })

    it('pushes the expenses under it when it is longer than the attached information', async () => {
      const documents = Array.from({ length: 8 }, (_, index) => ({
        name: `Document ${index + 1}`,
        url: first.url,
      }))
      const { places } = await coverWith(documents)
      const at = (text: string) => places.find((place) => place.text === text)
      expect(at('Expenses')?.y).toBeLessThan(at('Document 8')?.y ?? 0)
      expect(at('Document 8')?.y).toBeLessThan(at('Receipts')?.y ?? 0)
    })
  })

  it('continues a total longer than a page on the next, each of its lines on a page', async () => {
    const report = await reportOf('Air Canada, YYZ–CDG return')
    const expense = report.expenses[0] ?? new Expense()
    const currencies = Currency.all.slice(0, 70)
    const paid = currencies.map((currency) =>
      expense.afterChanging({
        description: 'Paid abroad',
        claimedAmount: undefined,
        isPaidInAnotherCurrency: true,
        foreignAmount: new Amount(1000),
        currency,
      }),
    )
    const pdf = await written(
      paid.reduce((each, other) => each.afterAdding(other), report.afterRemovingExpense(expense)),
    )
    const places = pdf
      .getPages()
      .flatMap((page) => placesOf(pdf, page))
      .filter((place) => /^[A-Z]{3}$/.test(place.text))
    expect(places.map((place) => place.text)).toEqual(currencies.map(({ code }) => code))
    for (const place of places) {
      expect(place.y).toBeGreaterThanOrEqual(54)
    }
  })

  it('keeps an amount of the total too wide for its column clear of its currency', async () => {
    const report = await reportOf('A very large claim')
    const expense = report.expenses[0] ?? new Expense()
    const pdf = await written(
      report.afterReplacing(
        expense,
        expense.afterChanging({ claimedAmount: new Amount(12_345_678_900) }),
      ),
    )
    const places = placesOf(pdf, pdf.getPage(0))
    const [code, amount] = [
      places.find((place) => place.text === 'CAD'),
      places.find((place) => place.text === '123,456,789.00'),
    ]
    expect(amount?.y).toBe(code?.y)
    expect(amount?.x).toBeGreaterThan((code?.x ?? 0) + 18)
  })

  it('itemizes each per diem with a meal claimed on the cover, its meals not claimed under it, with an Entered box', async () => {
    const invitation = new Document(
      Kind.additionalDocument,
      'invitation.pdf',
      await pdfOf([[612, 792]], 'Invitation'),
    )
    const october = (day: number) => new CalendarDate(2026, 10, day)
    const travel = (await reportOf('Air Canada, YYZ–CDG return'))
      .afterChanging({
        isBusinessTravel: true,
        firstDay: october(3),
        lastDay: october(5),
        locations: 'Rio de Janeiro, Brazil',
        travelJustifications: [invitation],
      })
      .afterChangingPerDiem(
        new PerDiem(october(4), {
          internationalMeals: Meal.all,
          mealsClaimed: [Meal.breakfast, Meal.dinner],
          reasons: new Map([[Meal.lunch, 'provided by the conference']]),
        }),
      )
      .afterChangingPerDiem(
        new PerDiem(october(5), { reasons: new Map([[Meal.lunch, 'at home']]) }),
      )
    const pdf = await written(travel)
    const places = placesOf(pdf, pdf.getPage(0))
    const at = (text: string) => places.find((place) => place.text === text)
    for (const text of [
      'Location(s)',
      'Rio de Janeiro, Brazil',
      'Per diem, international: breakfast, dinner',
      'Not claimed: lunch (provided by the conference)',
    ]) {
      expect(at(text), text).toBeDefined()
    }
    expect(at('USD 86.10')).toBeDefined()
    expect(at('86.10')?.y).toBe(at('USD')?.y)
    expect(at('Not claimed: lunch (provided by the conference)')?.x).toBeCloseTo(
      at('Per diem, international: breakfast, dinner')?.x ?? 0,
    )
    expect(places.some((place) => place.text.includes('at home'))).toBe(false)
    expect(
      pdf
        .getForm()
        .getFields()
        .map((box) => box.getName()),
    ).toEqual(['Entered, expense 1', 'Entered, expense 2'])
    expect(linksOf(pdf, pdf.getPage(0))).toHaveLength(2)
  })

  it('starts an expense and the line of its documents on the same page, however tall the expense', async () => {
    const report = await reportOf('Taxi 0 ride')
    const expense = report.expenses[0]
    if (expense === undefined) throw new TypeError('No expense')
    const till = await pdfOf([[226, 400]], 'Till')
    const receipt = (number: number) =>
      new Document(Kind.receipt, `receipt-${number}.pdf`, till, `receipt-${number}`)
    const words = (count: number) => ' to the hotel and back'.repeat(count)
    // One tall expense after more and more short ones walks down the page, in steps shorter
    // than a page, so that at some step it ends near the page's foot.
    for (let shorter = 4; shorter < 18; shorter += 1) {
      const many = Array.from({ length: shorter + 1 }, (_, index) =>
        expense.afterChanging({
          description: `Taxi ${index + 1} ride${words(index === shorter ? 6 : 0)}`,
          receipts: [receipt(index + 1)],
        }),
      )
      const pdf = await written(many.reduce((each, other) => each.afterAdding(other), report))
      const covers = pdf
        .getPages()
        .map((page) => textsOf(pdf, page))
        .filter((texts) => texts.includes('Description'))
      for (const texts of covers) {
        const expenses = texts.filter((text) => /^Taxi \d+ ride/.test(text))
        expect(texts.filter((text) => text === 'Receipt')).toHaveLength(expenses.length)
      }
    }
  }, 30_000)

  it('heads the cover in its top right corner, level with the logo', async () => {
    const pdf = await written(await reportOf('Taxi'))
    const places = placesOf(pdf, pdf.getPage(0))
    const title = places.find((place) => place.text === 'McSCert Expense Report')
    const date = places.find((place) => place.text === '2026-11-07')
    const name = places.find((place) => place.text === 'Name of claimant')
    const logoBottom = 792 - 54 - (170 * 179) / 1066
    expect(title?.x).toBeGreaterThan(306)
    expect(title?.y).toBeCloseTo(792 - 54 - 18 * 0.714, 1)
    expect(date?.x).toBeGreaterThan(306)
    expect(date?.y).toBeCloseTo(logoBottom, 1)
    expect(name?.y).toBeLessThan(logoBottom)
    // Both end at the right margin, so the wider title starts further left.
    expect(title?.x ?? 0).toBeLessThan(date?.x ?? 0)
  })

  it('puts every page on a Letter page, a larger one scaled down to fit it, and shows it portrait', async () => {
    const pdf = await written(await reportOf('Taxi'))
    const sizes = pdf.getPages().map((page) => [page.getWidth(), page.getHeight()])
    expect(sizes).toEqual([...Array(5).fill([612, 792]), [792, 612]])
    expect(pdf.getPages().map(shown)).toEqual(Array(6).fill([612, 792]))
    expect(pdf.getPage(5).getRotation().angle).toBe(270)
    const a4 = decoded(streamsOf(pdf, pdf.getPage(2))[0])
    const factor = Number(/^(\S+) 0 0 \1 0 0 cm$/m.exec(a4)?.[1])
    expect(factor).toBeCloseTo(792 / 842)
    expect(a4).toContain(`0 0 ${595 * factor} ${842 * factor} re`)
  })

  it('keeps a Letter page as it is, never enlarges a small one, and keeps hidden what its crop box hid, annotations included', async () => {
    const source = await PDFDocument.create()
    const font = await source.embedFont(StandardFonts.Helvetica)
    source.addPage([612, 792]).drawText('Letter', { x: 50, y: 50, size: 12, font })
    const till = source.addPage([226, 600])
    till.drawText('Till', { x: 50, y: 50, size: 12, font })
    till.setCropBox(20, 30, 180, 500)
    const notes: Record<string, number[]> = {
      inside: [40, 40, 80, 80],
      outside: [190, 550, 220, 590],
      across: [180, 500, 220, 560],
    }
    for (const [contents, rect] of Object.entries(notes)) {
      const note = source.context.obj({
        Type: 'Annot',
        Subtype: 'Square',
        Rect: rect,
        Contents: contents,
      })
      till.node.addAnnot(source.context.register(note))
    }
    const receipt = new Document(Kind.receipt, 'till.pdf', await source.save())
    const report = await reportOf('Taxi')
    const expense = report.expenses[0]
    if (expense === undefined) throw new TypeError('No expense')
    const pdf = await written(
      report.afterReplacing(expense, expense.afterChanging({ receipts: [receipt] })),
    )
    const letter = pdf.getPage(2)
    expect(letter.getCropBox()).toEqual({ x: 0, y: 0, width: 612, height: 792 })
    expect(decoded(streamsOf(pdf, letter)[0])).toMatch(/0 0 612 792 re\s+W\s+n\s+1 0 0 1 0 0 cm/)
    const page = pdf.getPage(3)
    expect(page.getCropBox()).toEqual({ x: 20 - 216, y: 30 - 146, width: 612, height: 792 })
    expect(page.getMediaBox()).toEqual(page.getCropBox())
    const wrapper = decoded(streamsOf(pdf, page)[0])
    expect(wrapper).toMatch(/20 30 180 500 re\s+W\s+n\s+1 0 0 1 0 0 cm/)
    expect(stampedTextsOf(pdf, page)).toEqual(['Till', 'R1 · Expense 1: Taxi · 4 / 6'])
    const kept = (page.node.Annots()?.asArray() ?? [])
      .map((reference) => pdf.context.lookup(reference, PDFDict))
      .filter((annotation) => annotation.get(PDFName.of('Subtype')) === PDFName.of('Square'))
      .map((annotation) => annotation.lookup(PDFName.of('Contents'))?.toString())
    expect(kept).toEqual(['/inside', '/across'])
  })

  it('shows a photo upright, mirrored and turned as its Exif orientation says', async () => {
    const report = await reportOf('Taxi')
    const expense = report.expenses[0]
    if (expense === undefined) throw new TypeError('No expense')
    const pages = await Promise.all(
      [undefined, 6, 7].map(async (orientation) => {
        const photo = new Document(Kind.receipt, 'photo.jpg', jpegOf(400, 300, orientation))
        const pdf = await written(
          report.afterReplacing(expense, expense.afterChanging({ receipts: [photo] })),
        )
        return pdf.getPage(2)
      }),
    )
    const [stored, turned, mirrored] = pages
    expect(stored?.getRotation().angle).toBe(270)
    expect(turned?.getRotation().angle).toBe(90)
    expect(mirrored?.getRotation().angle).toBe(90)
    const mirror = /-1 0 0 1 [\d.]+ 0 cm/
    for (const [page, isMirrored] of [
      [stored, false],
      [turned, false],
      [mirrored, true],
    ] as const) {
      if (page === undefined) throw new TypeError('No page')
      const content = streamsOf(page.doc, page).map(decoded).join('\n')
      expect(mirror.test(content)).toBe(isMirrored)
    }
    for (const page of pages) {
      if (page === undefined) throw new TypeError('No page')
      expect([page.getWidth(), page.getHeight()]).toEqual([792, 612])
      expect(shown(page)).toEqual([612, 792])
    }
  })

  it('turns a landscape page portrait, and stamps a page turned already upright on screen', async () => {
    const source = await PDFDocument.create()
    const font = await source.embedFont(StandardFonts.Helvetica)
    source.addPage([842, 595]).drawText('Landscape', { x: 50, y: 50, size: 12, font })
    const scanned = source.addPage([842, 595])
    scanned.drawText('Scanned', { x: 50, y: 50, size: 12, font })
    scanned.setRotation(degrees(90))
    const sideways = source.addPage([612, 792])
    sideways.drawText('Sideways', { x: 50, y: 50, size: 12, font })
    sideways.setRotation(degrees(90))
    const receipt = new Document(Kind.receipt, 'statement.pdf', await source.save())
    const report = await reportOf('Air Canada, YYZ–CDG return')
    const expense = report.expenses[0]
    if (expense === undefined) throw new TypeError('No expense')
    const pdf = await written(
      report.afterReplacing(expense, expense.afterChanging({ receipts: [receipt] })),
    )
    const [landscape, turned, upright] = [2, 3, 4].map((index) => pdf.getPage(index))
    expect([landscape, turned, upright].map((page) => page?.getRotation().angle)).toEqual([
      270, 90, 0,
    ])
    for (const page of [landscape, turned, upright]) {
      if (page === undefined) throw new TypeError('No page')
      const [width = 0, height = 0] = shown(page)
      expect(width).toBeLessThan(height)
      expect(stampedTextsOf(pdf, page).at(-1)).toMatch(
        /^R1 · Expense 1: Air Canada, YYZ–CDG return · \d \/ 7$/,
      )
    }
    const link = linksOf(pdf, turned as PDFPage)[0]
    const crop = (turned as PDFPage).getCropBox()
    expect(link?.left).toBeGreaterThan(crop.x + crop.width - 60)
    expect(link?.width).toBeLessThan(15)
  })

  it("names the document after the purpose, the claimant and the system's version", async () => {
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
      .filter((texts) => texts.includes('Description'))
    expect(covers.length).toBeGreaterThan(1)
    const text = covers.flat().join(' ')
    expect(text).toContain('Attendee 160 (McMaster)')
    expect(text).toContain('Total')
  })
})

describe('a missing receipt authorization', () => {
  const stated = (
    fields: Partial<ConstructorParameters<typeof MissingReceipt>[0]> = {},
    description = 'Taxi from CDG to the hotel',
  ) =>
    new Report({
      claimantName: 'Zoë Łukasiewicz',
      position: 'Faculty',
      email: 'zoe@mcmaster.ca',
      purpose: 'ICSE 2026',
      accountName: '20-123-456',
    }).afterAdding(
      new Expense({
        date: new CalendarDate(2026, 10, 5),
        description,
        claimedAmount: new Amount(5500),
        isPaidInAnotherCurrency: true,
        foreignAmount: new Amount(3500),
        currency: Currency.parse('EUR'),
        isPaidInCash: true,
        missingReceipt: new MissingReceipt({
          reason: 'The driver had no receipt book.',
          paidTo: 'Taxis Parisiens',
          jobTitle: 'Associate Prof',
          phoneExtension: '24242',
          ...fields,
        }),
      }),
    )
  const imageWidthsOf = (pdf: PDFDocument, page: PDFPage) => {
    const images = page.node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)
    return [...(images?.entries() ?? [])].map(([, reference]) => {
      const image = pdf.context.lookup(reference) as PDFRawStream
      return (image.dict.lookup(PDFName.of('Width')) as PDFNumber).asNumber()
    })
  }
  const wording = [
    'Missing Receipt Authorization Form',
    'Original invoices on company letterhead or official receipts are required for reimbursements. Where the original invoice or receipt is not issued or lost, then a copy of the official invoice or receipt or a credit card statement will be accepted as a substitute with a brief explanation and notation of "original lost" clearly indicated on the substituting support.',
    'EXPLANATORY NOTE',
    'Please accept this as proof of expenditure for the missing original receipt.',
    'Reason for missing original receipt or boarding pass(es):',
    'I certify that this expense has not and will not be claimed for reimbursement from other sources or institutions.',
  ]

  it("reproduces McMaster's wording, filled in, on one page, its signature left blank", async () => {
    const pdf = await written(stated())
    expect(pdf.getPageCount()).toBe(3)
    const page = pdf.getPage(2)
    const texts = textsOf(pdf, page)
    const joined = texts.join(' ')
    for (const sentence of wording) expect(joined).toContain(sentence)
    expect(texts).toEqual(
      expect.arrayContaining([
        'The driver had no receipt book.',
        'Paid to:',
        'Taxis Parisiens',
        'Dated:',
        '2026-10-05',
        'Amount:',
        'CAD 55.00 (EUR 35.00)',
        'Description of Expense(s):',
        'Taxi from CDG to the hotel',
        'Signature of Claimant:',
        'Printed Name:',
        'Zoë Łukasiewicz',
        'Title:',
        'Associate Prof',
        'Extension:',
        '24242',
        'Email:',
        'zoe@mcmaster.ca',
      ]),
    )
    const at = (text: string) => texts.indexOf(text)
    expect(at('Printed Name:') - at('Signature of Claimant:')).toBe(1)
  })

  it('writes each name left of its value, on the same line', async () => {
    const pdf = await written(stated())
    const places = placesOf(pdf, pdf.getPage(2))
    const placeOf = (text: string) => places.find((place) => place.text === text)
    for (const [name, value] of [
      ['Paid to:', 'Taxis Parisiens'],
      ['Dated:', '2026-10-05'],
      ['Amount:', 'CAD 55.00 (EUR 35.00)'],
      ['Printed Name:', 'Zoë Łukasiewicz'],
      ['Title:', 'Associate Prof'],
      ['Extension:', '24242'],
      ['Email:', 'zoe@mcmaster.ca'],
    ] as const) {
      expect(placeOf(value)?.y).toBe(placeOf(name)?.y)
      expect(placeOf(value)?.x).toBeGreaterThan(placeOf(name)?.x ?? Number.POSITIVE_INFINITY)
    }
    expect(placeOf('Dated:')?.y).toBe(placeOf('Amount:')?.y)
    expect(placeOf('Extension:')?.y).toBe(placeOf('Email:')?.y)
  })

  it("goes under McMaster's logo, which a report document without a form does not hold", async () => {
    const pdf = await written(stated())
    expect(imageWidthsOf(pdf, pdf.getPage(2))).toEqual([600])
    expect(imageWidthsOf(pdf, pdf.getPage(0))).not.toContain(600)
    const without = await written(await reportOf('Air Canada'))
    const widths = without.getPages().flatMap((page) => imageWidthsOf(without, page))
    expect(widths).not.toContain(600)
  })

  it('uses the height of the page: its last line ends just above the bottom margin, on one page', async () => {
    const lowest = async (report: Report) => {
      const pdf = await written(report)
      expect(pdf.getPageCount()).toBe(3)
      return placesOf(pdf, pdf.getPage(2)).find(({ text }) => text === 'Email:')?.y ?? 0
    }
    // The bottom margin, the space under the last line of the frame, and the space under its text.
    const expected = 54 + 12 + 3
    expect(await lowest(stated())).toBeCloseTo(expected, 1)
    const longer = Array.from({ length: 20 }, () => 'A reason that takes room').join(' ')
    expect(await lowest(stated({ reason: longer }))).toBeCloseTo(expected, 1)
  })

  it('gives the phone extension a short line, and the email most of the line they share', async () => {
    const pdf = await written(stated())
    const places = placesOf(pdf, pdf.getPage(2))
    const start = (text: string) => places.find((place) => place.text === text)?.x ?? 0
    expect(start('Email:') - start('Extension:')).toBeLessThan(160)
    expect(start('Amount:')).toBeGreaterThan(start('Email:'))
  })

  it('has a section page naming who was paid and the expense, and a stamp naming the expense', async () => {
    const pdf = await written(stated())
    expect(textsOf(pdf, pdf.getPage(1))).toEqual(
      expect.arrayContaining([
        'Missing receipt authorizations',
        'M1',
        'Taxis Parisiens',
        '3',
        'Taxi from CDG to the hotel',
      ]),
    )
    expect(stampedTextsOf(pdf, pdf.getPage(2))).toContain(
      'M1 · Expense 1: Taxi from CDG to the hotel · 3 / 3',
    )
  })

  it('is linked from the cover and from its section page, and links back to its expense', async () => {
    const pdf = await written(stated())
    expect(textsOf(pdf, pdf.getPage(0))).toEqual(
      expect.arrayContaining(['Missing receipt', 'Paid in cash']),
    )
    expect(linksOf(pdf, pdf.getPage(0)).map(({ to }) => to)).toEqual([3])
    expect(linksOf(pdf, pdf.getPage(1)).map(({ to }) => to)).toEqual(expect.arrayContaining([3, 1]))
    expect(linksOf(pdf, pdf.getPage(2)).map(({ to }) => to)).toEqual([1])
  })

  it('never cuts a long reason or description: it continues, the signature under what is signed', async () => {
    const reason = Array.from({ length: 80 }, (_, index) => `Reason${index}`).join(' and then ')
    const description = Array.from({ length: 200 }, (_, index) => `Attendee${index}`).join(', ')
    const pdf = await written(stated({ reason }, description))
    const isStamped = (page: PDFPage) =>
      stampedTextsOf(pdf, page).some((text) => text.startsWith('M1 ·'))
    const pages = pdf.getPages().filter(isStamped)
    expect(pages.length).toBeGreaterThan(1)
    const all = pages.flatMap((page) => textsOf(pdf, page)).join(' ')
    expect(all).toContain('Reason79')
    expect(all).toContain('Attendee199')
    const last = pages.at(-1) as PDFPage
    const signed = textsOf(pdf, last)
    expect(signed.join(' ')).toContain(wording[5])
    for (const text of ['Signature of Claimant:', 'Printed Name:', 'Title:', 'Email:']) {
      expect(signed).toContain(text)
    }
    pages.forEach((page, index) => {
      expect(placesOf(pdf, page).every(({ y }) => y >= 54 || y < 40)).toBe(true)
      expect(index === 0 || !textsOf(pdf, page).includes('EXPLANATORY NOTE')).toBe(true)
    })
  })

  it('keeps the line breaks of a reason and a description, and cuts no word too long for a line', async () => {
    const word = 'x'.repeat(200)
    const pdf = await written(stated({ reason: 'First line\nSecond line' }, `One\n${word}\nThree`))
    const texts = textsOf(pdf, pdf.getPage(2))
    expect(texts).toEqual(expect.arrayContaining(['First line', 'Second line', 'One', 'Three']))
    expect(texts.join('')).toContain(word)
  })

  it('starts a long description next to its name and goes on across the frame', async () => {
    const description = Array.from({ length: 30 }, (_, index) => `Attendee${index}`).join(' ')
    const pdf = await written(stated({}, description))
    const places = placesOf(pdf, pdf.getPage(2))
    const named = places.find(({ text }) => text === 'Description of Expense(s):')
    const first = places.find(({ text }) => text.startsWith('Attendee0'))
    const next = places.find(({ text }) => text.includes('Attendee29'))
    expect(first?.y).toBe(named?.y)
    expect(next?.x).toBeLessThan(first?.x ?? 0)
    expect(next?.y).toBeLessThan(first?.y ?? 0)
  })
})

describe('an expense paid in cash', () => {
  it('says Paid in cash on the cover, no link and no section page for it', async () => {
    const receipt = new Document(Kind.receipt, 'taxi.png', png)
    const report = new Report({
      claimantName: 'Zoë Łukasiewicz',
      position: 'Faculty',
      email: 'zoe@mcmaster.ca',
      purpose: 'ICSE 2026',
      accountName: '20-123-456',
    }).afterAdding(
      new Expense({
        date: new CalendarDate(2026, 10, 3),
        description: 'Taxi',
        claimedAmount: new Amount(5500),
        receipts: [receipt],
        isPaidInCash: true,
      }),
    )
    const pdf = await written(report)
    const cover = pdf.getPage(0)
    expect(textsOf(pdf, cover)).toEqual(expect.arrayContaining(['Receipt', 'Paid in cash']))
    expect(pdf.getPageCount()).toBe(3)
    expect(linksOf(pdf, cover).map(({ to }) => to)).toEqual([3])
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

describe('the size of what it holds', () => {
  /** A report whose receipt holds the content given, and the document it is written into. */
  async function writtenWith(
    content: Uint8Array,
    encoder: ImageEncoder = neverEncoding,
    isReduced = false,
  ): Promise<PDFDocument> {
    const base = await reportOf('Taxi')
    const replaced = new Document(Kind.receipt, 'taxi', content, undefined, isReduced)
    const report = new Report({ ...base, expenses: [] }).afterAdding(
      (base.expenses[0] as Expense).afterChanging({ receipts: [replaced] }),
    )
    const bytes = await writeReportDocument({
      layout: layoutOf(report),
      palette,
      version: '0.1.0',
      writtenOn: new CalendarDate(2026, 11, 7),
      documents: new DocumentsAsWritten(encoder),
    })
    return PDFDocument.load(bytes, { updateMetadata: false })
  }

  const streamsOf = (pdf: PDFDocument) =>
    pdf.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((object): object is PDFRawStream => object instanceof PDFRawStream)

  it('leaves out of a copied page what no reader shows', async () => {
    const source = await PDFDocument.create()
    const page = source.addPage([612, 792])
    const noise = new Uint8Array(50_000).map((_, index) => (index * index * 31) % 251)
    const thumbnail = source.context.flateStream(noise, { Marked: 'thumbnail' })
    page.node.set(PDFName.of('Thumb'), source.context.register(thumbnail))
    const pdf = await writtenWith(await source.save())
    expect(pdf.getPages().every((each) => !each.node.has(PDFName.of('Thumb')))).toBe(true)
    expect(streamsOf(pdf).some((stream) => stream.dict.has(PDFName.of('Marked')))).toBe(false)
  })

  it('leaves the Exif data of a photo out of the report document', async () => {
    const pdf = await writtenWith(jpegOf(40, 30, 6))
    const image = streamsOf(pdf).find(
      (stream) => stream.dict.get(PDFName.of('Filter')) === PDFName.of('DCTDecode'),
    )
    expect(image).toBeDefined()
    expect(String.fromCharCode(...(image?.contents ?? []))).not.toContain('Exif')
  })

  it('leaves the Exif data of a JPEG in a copied page out of the report document', async () => {
    const source = await PDFDocument.create()
    const page = source.addPage([612, 792])
    page.drawImage(await source.embedJpg(jpegOf(40, 30, 6)), { x: 0, y: 0, width: 40, height: 30 })
    const pdf = await writtenWith(await source.save())
    const image = streamsOf(pdf).find(
      (stream) => stream.dict.get(PDFName.of('Filter')) === PDFName.of('DCTDecode'),
    )
    expect(image).toBeDefined()
    expect(String.fromCharCode(...(image?.contents ?? []))).not.toContain('Exif')
  })

  it('holds a large image as added until the Claimant reduces it, encoding nothing', async () => {
    const large = new Uint8Array(5_000_000)
    large.set(jpegOf(4000, 3000))
    const pdf = await writtenWith(large)
    const image = streamsOf(pdf).find(
      (stream) => stream.dict.get(PDFName.of('Filter')) === PDFName.of('DCTDecode'),
    )
    expect(image?.contents.length).toBe(large.length)
  })

  it('holds a large image the Claimant reduced as encoded, on a Letter page', async () => {
    const large = new Uint8Array(2_000_000)
    large.set(jpegOf(4000, 3000))
    const encoded = jpegOf(2200, 1650)
    const encoder: ImageEncoder = { jpeg: async () => encoded, png: async () => encoded }
    const pdf = await writtenWith(large, encoder, true)
    const image = streamsOf(pdf).find(
      (stream) => stream.dict.get(PDFName.of('Filter')) === PDFName.of('DCTDecode'),
    )
    expect(image?.contents.length).toBe(encoded.length)
    const sizes = pdf.getPages().map((page) => [page.getWidth(), page.getHeight()].sort())
    expect(sizes.every(([short, long]) => short === 612 && long === 792)).toBe(true)
  })

  it('holds a PNG that encoding made a JPEG as a JPEG', async () => {
    const large = new Uint8Array(2_000_000)
    large.set(png.subarray(0, 8))
    const encoded = jpegOf(2200, 1650)
    const notSmaller = new Uint8Array(1_000_000)
    notSmaller.set([0x89, 0x50, 0x4e, 0x47])
    const encoder: ImageEncoder = { jpeg: async () => encoded, png: async () => notSmaller }
    const pdf = await writtenWith(large, encoder, true)
    expect(
      streamsOf(pdf).some(
        (stream) => stream.dict.get(PDFName.of('Filter')) === PDFName.of('DCTDecode'),
      ),
    ).toBe(true)
  })
})
