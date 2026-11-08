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
import { PerDiem } from '../domain/per-diem.ts'
import { Report } from '../domain/report.ts'
import { paletteFrom } from './palette.ts'
import { wrap, writeReportDocument } from './write-report-document.ts'

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
  it("links each name of an expense's row to its document, and each page of a document back to the row", async () => {
    const pdf = await written(await reportOf('Air Canada, YYZ–CDG return'))
    const pages = pdf.getPages()
    const [cover, receipts, boarding, pass, statements, statement] = pages.map((page) =>
      linksOf(pdf, page),
    )
    expect(cover?.map(({ to, how }) => [to, how])).toEqual([
      [3, '/Fit'],
      [6, '/Fit'],
    ])
    expect(cover?.[0]?.left).toBeLessThan(cover?.[1]?.left ?? 0)
    expect(cover?.[0]?.bottom).toBe(cover?.[1]?.bottom)
    expect(cover?.[0]?.left).toBeCloseTo(54 + 22 + 62 + 4)
    for (const links of [receipts, statements, boarding, pass, statement]) {
      expect(links?.map(({ to, how }) => [to, how])).toEqual([[1, '/XYZ']])
    }
    const row = boarding?.[0]?.top ?? 0
    expect(row).toBeGreaterThan(54)
    expect(row).toBeLessThan(792 - 54)
    expect(statement?.[0]?.top).toBe(row)
    expect(boarding?.[0]?.width).toBeGreaterThan(120)
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
    const [content, base, ...expenseLines] = textsOf(pdf, boarding)
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
        'air-canada',
        'statement-octobre',
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
    expect(boarding).toEqual(['Boarding', 'R1 · Expense 1: Air Canada, YYZ–CDG return · 3 / 6'])
    expect(pass).toEqual(['Boarding', 'R1 · Expense 1: Air Canada, YYZ–CDG return · 4 / 6'])
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
    expect(statement).toEqual(['S1 · Expense 1: Air Canada, YYZ–CDG return · 6 / 6'])
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
    expect(cover).toEqual(expect.arrayContaining(['air-canada', 'Visa, October', '1 / 9']))
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
    expect(justification).toEqual(['A1 · Invitation from ICSE · 3 / 9'])
    expect(itineraryPage).toEqual(['Itinerary', 'A2 · itinerary · 4 / 9'])
    expect(receipts).toEqual(expect.arrayContaining(['Receipts', 'R1']))
    expect(statements).toEqual(expect.arrayContaining(['Bank statements', 'S1', 'Visa, October']))
    expect(last).toEqual(['S1 · Expense 1: Air Canada, YYZ–CDG return · 9 / 9'])
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
      'air-canada',
      ' · ',
      'statement-octobre',
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
    const links = linksOf(pdf, statements)
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
    expect(textsOf(pdf, pdf.getPage(2)).at(-1)).toBe(
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
    const [cad, euro] = places
      .filter((each) => ['$1,012.35', 'EUR 55.00'].includes(each.text))
      .slice(-2)
    expect(cad?.text).toBe('$1,012.35')
    expect(euro?.text).toBe('EUR 55.00')
    expect(euro?.x).toBe(cad?.x)
    expect(euro?.y).toBeLessThan(cad?.y ?? 0)
    expect(place('Total')?.y).toBe(cad?.y)
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
          isInternational: true,
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
      'Locations',
      'Rio de Janeiro, Brazil',
      'Per diem, international: breakfast, dinner',
      'Not claimed: lunch (provided by the conference)',
    ]) {
      expect(at(text), text).toBeDefined()
    }
    expect(places.filter((place) => place.text === 'USD 86.10')).toHaveLength(2)
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
      const pageOf = (isWanted: (text: string) => boolean) =>
        pdf.getPages().findIndex((page) => textsOf(pdf, page).some(isWanted))
      const tall = shorter + 1
      const description = pageOf((text) => text.startsWith(`Taxi ${tall} ride`))
      expect(description).toBeGreaterThanOrEqual(0)
      expect(pageOf((text) => text === `receipt-${tall}`)).toBe(description)
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
    expect(textsOf(pdf, page)).toEqual(['Till', 'R1 · Expense 1: Taxi · 4 / 6'])
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
      expect(textsOf(pdf, page).at(-1)).toMatch(
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
