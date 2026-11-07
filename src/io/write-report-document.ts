import fontkit from '@cantoo/fontkit'
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from '@cantoo/pdf-lib'
import boldFont from '../assets/fonts/NotoSans-Bold.ttf?inline'
import regularFont from '../assets/fonts/NotoSans-Regular.ttf?inline'
import logoImage from '../assets/mcscert-left-col.png?inline'
import type { CalendarDate } from '../domain/calendar-date.ts'
import type { Document } from '../domain/document.ts'
import type { LabelledDocument, Layout, Section } from '../domain/layout.ts'
import { bytesOf } from './inlined.ts'
import type { Colour, Palette } from './palette.ts'

/** What the report document is written from. */
export interface Writing {
  readonly layout: Layout
  readonly palette: Palette
  /** The version of the system, written as the document's creator. */
  readonly version: string
  /** The date the document is written, under the cover's heading. */
  readonly writtenOn: CalendarDate
}

const letterPortrait: [number, number] = [612, 792]
const letterLandscape: [number, number] = [792, 612]
/** Three-quarter-inch margins. */
const margin = 54
const stampBaseline = 24
const logoWidth = 170
const bodySize = 10
const tableSize = 9
const stampSize = 8
const leading = 1.35

/** A column of a table: its title and its width in points. */
interface Column {
  readonly title: string
  readonly width: number
}

/** A page of the report document and what its stamp says besides the page number. */
interface StampedPage {
  readonly page: PDFPage
  readonly stamp: string
}

/** A document read for its pages: a PDF to copy, or an image to place on a page of its own. */
type Source =
  | { readonly format: 'pdf'; readonly pdf: PDFDocument; readonly pageCount: number }
  | { readonly format: 'jpeg' | 'png'; readonly pageCount: 1 }

/**
 * Writes the report document of a layout: the cover, then each section, its section pages and
 * its documents, every page stamped. It draws, copies, paginates and stamps; the order, the
 * labels, the numbers and the total come from the layout.
 */
export async function writeReportDocument(writing: Writing): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const writer = new Writer({
    pdf,
    palette: writing.palette,
    regular: await pdf.embedFont(bytesOf(regularFont), { subset: true }),
    bold: await pdf.embedFont(bytesOf(boldFont), { subset: true }),
    logo: await pdf.embedPng(bytesOf(logoImage)),
  })
  writer.writeCover(writing.layout, writing.writtenOn)
  for (const section of writing.layout.sections) {
    await writer.writeSection(section)
  }
  writer.stampEveryPage()
  pdf.setTitle(writing.layout.title)
  pdf.setAuthor(writing.layout.author)
  pdf.setCreator(`McSCert Expense Report v${writing.version}`)
  pdf.setProducer(`McSCert Expense Report v${writing.version}`)
  return pdf.save()
}

/** Whether the bytes are a PDF, a JPEG image or a PNG image, from their first bytes. */
function formatOf(content: Uint8Array): 'pdf' | 'jpeg' | 'png' {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => content[index] === byte)
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'png'
  if (starts(0xff, 0xd8, 0xff)) return 'jpeg'
  return 'pdf'
}

async function sourceOf(document: Document): Promise<Source> {
  const format = formatOf(document.content)
  if (format !== 'pdf') {
    return { format, pageCount: 1 }
  }
  const pdf = await PDFDocument.load(document.content)
  return { format, pdf, pageCount: pdf.getPageCount() }
}

/** The lines a text wraps into within a width, breaking a word longer than the width. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const fits = (candidate: string) => font.widthOfTextAtSize(candidate, size) <= width
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter((piece) => piece !== '')) {
      for (const piece of breakWord(word, fits)) {
        const candidate = line === '' ? piece : `${line} ${piece}`
        if (fits(candidate)) {
          line = candidate
        } else {
          if (line !== '') lines.push(line)
          line = piece
        }
      }
    }
    lines.push(line)
  }
  return lines
}

function breakWord(word: string, fits: (text: string) => boolean): string[] {
  if (fits(word)) {
    return [word]
  }
  const pieces: string[] = []
  let piece = ''
  for (const character of word) {
    if (piece !== '' && !fits(piece + character)) {
      pieces.push(piece)
      piece = ''
    }
    piece += character
  }
  pieces.push(piece)
  return pieces
}

/**
 * The generated pages being written, one after the other: a cursor going down the page, a new
 * page when what comes next does not fit. When counting, nothing is drawn and pages are only
 * counted, so that a section knows how many section pages it takes before writing them.
 */
class Flow {
  pageCount = 0
  private page: PDFPage | undefined
  private y = 0
  private continuation: () => void = () => {}
  private readonly writer: Writer
  private readonly isCounting: boolean

  constructor(writer: Writer, isCounting: boolean) {
    this.writer = writer
    this.isCounting = isCounting
    this.newPage()
  }

  get top(): number {
    return letterPortrait[1] - margin
  }

  /** What is drawn at the top of each page after the first, such as a table's header. */
  continueWith(continuation: () => void): void {
    this.continuation = continuation
  }

  stopContinuing(): void {
    this.continuation = () => {}
  }

  /** Room for a height, on this page or the next. */
  ensure(height: number): void {
    if (this.y - height < margin) {
      this.newPage()
      this.continuation()
    }
  }

  down(height: number): void {
    this.y -= height
  }

  text(text: string, x: number, font: PDFFont, size: number, colour: Colour): void {
    this.page?.drawText(text, { x, y: this.y - size, size, font, color: colourOf(colour) })
  }

  rule(colour: Colour, thickness: number): void {
    this.page?.drawLine({
      start: { x: margin, y: this.y },
      end: { x: letterPortrait[0] - margin, y: this.y },
      thickness,
      color: colourOf(colour),
    })
  }

  box(x: number, size: number, colour: Colour, isTicked: boolean): void {
    const page = this.page
    if (page === undefined) return
    const bottom = this.y - size
    page.drawRectangle({
      x,
      y: bottom,
      width: size,
      height: size,
      borderColor: colourOf(colour),
      borderWidth: 0.75,
    })
    if (isTicked) {
      const color = colourOf(colour)
      const [left, right, top] = [x + 2, x + size - 2, this.y - 2]
      page.drawLine({ start: { x: left, y: top }, end: { x: right, y: bottom + 2 }, color })
      page.drawLine({ start: { x: left, y: bottom + 2 }, end: { x: right, y: top }, color })
    }
  }

  private newPage(): void {
    this.pageCount += 1
    this.page = this.isCounting ? undefined : this.writer.addGeneratedPage()
    this.y = this.top
    const logoHeight = (logoWidth * this.writer.logo.height) / this.writer.logo.width
    this.page?.drawImage(this.writer.logo, {
      x: margin,
      y: this.y - logoHeight,
      width: logoWidth,
      height: logoHeight,
    })
    this.y -= logoHeight + 18
  }
}

/** What the writer draws with. */
interface Means {
  readonly pdf: PDFDocument
  readonly palette: Palette
  readonly regular: PDFFont
  readonly bold: PDFFont
  readonly logo: PDFImage
}

class Writer {
  readonly pages: StampedPage[] = []
  readonly logo: PDFImage
  private readonly pdf: PDFDocument
  private readonly palette: Palette
  private readonly regular: PDFFont
  private readonly bold: PDFFont

  constructor(means: Means) {
    this.pdf = means.pdf
    this.palette = means.palette
    this.regular = means.regular
    this.bold = means.bold
    this.logo = means.logo
  }

  addGeneratedPage(): PDFPage {
    const page = this.pdf.addPage(letterPortrait)
    this.pages.push({ page, stamp: '' })
    return page
  }

  writeCover(layout: Layout, writtenOn: CalendarDate): void {
    const flow = new Flow(this, false)
    this.paragraph(flow, 'McSCert Expense Report', this.bold, 18, this.palette.maroon)
    this.paragraph(flow, writtenOn.toString(), this.regular, bodySize, this.palette.grey)
    flow.down(12)
    for (const field of layout.coverFields) {
      this.fieldLine(flow, field.name, field.value)
    }
    flow.down(12)
    this.heading(flow, 'Attached information')
    for (const information of layout.attachedInformation) {
      const height = bodySize * leading
      flow.ensure(height)
      flow.box(margin, bodySize, this.palette.black, information.isAttached)
      const text = [information.kind.plural, information.labels].filter(Boolean).join('  ')
      flow.text(text, margin + 18, this.regular, bodySize, this.palette.black)
      flow.down(height)
    }
    flow.down(12)
    this.heading(flow, 'Expenses')
    const columns: Column[] = [
      { title: '#', width: 22 },
      { title: 'Date', width: 62 },
      { title: 'Description', width: 170 },
      { title: 'Foreign amount', width: 72 },
      { title: 'Claimed (CAD)', width: 76 },
      { title: 'Supporting documents', width: 102 },
    ]
    const rows = layout.expenses.map((row) => [
      String(row.number),
      row.date,
      row.description,
      row.foreignAmount,
      row.claimedAmount,
      row.supportingDocuments,
    ])
    this.table(flow, columns, rows)
    this.tableRow(flow, columns, ['', '', 'Total', '', layout.total, ''], this.bold)
    flow.stopContinuing()
  }

  async writeSection(section: Section): Promise<void> {
    const sources = await Promise.all(section.documents.map((entry) => sourceOf(entry.document)))
    const counting = new Flow(this, true)
    this.sectionPage(counting, section, sources, 0)
    const firstPage = this.pages.length + counting.pageCount + 1
    this.sectionPage(new Flow(this, false), section, sources, firstPage)
    for (const [index, entry] of section.documents.entries()) {
      const source = sources[index]
      if (source !== undefined) {
        await this.copy(entry, source)
      }
    }
  }

  stampEveryPage(): void {
    const total = this.pages.length
    this.pages.forEach(({ page, stamp }, index) => {
      const text = [stamp, `${index + 1} / ${total}`].filter(Boolean).join(' · ')
      const box = page.getCropBox()
      const width = this.regular.widthOfTextAtSize(text, stampSize)
      page.drawText(text, {
        x: box.x + box.width - margin - width,
        y: box.y + stampBaseline,
        size: stampSize,
        font: this.regular,
        color: colourOf(this.palette.grey),
      })
    })
  }

  private sectionPage(flow: Flow, section: Section, sources: Source[], firstPage: number): void {
    this.paragraph(flow, section.title, this.bold, 16, this.palette.maroon)
    flow.down(6)
    const columns: Column[] = [
      { title: 'Label', width: 50 },
      { title: 'File', width: 254 },
      { title: 'Pages', width: 70 },
      { title: 'Expenses', width: 130 },
    ]
    let page = firstPage
    const rows = section.documents.map((entry, index) => {
      const count = sources[index]?.pageCount ?? 1
      const pages = count === 1 ? String(page) : `${page}–${page + count - 1}`
      page += count
      return [entry.label, entry.document.fileName, pages, entry.expenseNumbers]
    })
    this.table(flow, columns, rows)
    flow.stopContinuing()
  }

  private async copy(entry: LabelledDocument, source: Source): Promise<void> {
    const stamp = `${entry.label} · ${entry.expenses}`
    if (source.format === 'pdf') {
      const copied = await this.pdf.copyPages(source.pdf, source.pdf.getPageIndices())
      for (const page of copied) {
        this.pages.push({ page: this.pdf.addPage(page), stamp })
      }
      return
    }
    const image =
      source.format === 'png'
        ? await this.pdf.embedPng(entry.document.content)
        : await this.pdf.embedJpg(entry.document.content)
    const size = image.width > image.height ? letterLandscape : letterPortrait
    const scale = Math.min(
      1,
      (size[0] - 2 * margin) / image.width,
      (size[1] - 2 * margin) / image.height,
    )
    const [width, height] = [image.width * scale, image.height * scale]
    const page = this.pdf.addPage(size)
    page.drawImage(image, { x: (size[0] - width) / 2, y: (size[1] - height) / 2, width, height })
    this.pages.push({ page, stamp })
  }

  private paragraph(flow: Flow, text: string, font: PDFFont, size: number, colour: Colour): void {
    for (const line of wrap(text, font, size, letterPortrait[0] - 2 * margin)) {
      flow.ensure(size * leading)
      flow.text(line, margin, font, size, colour)
      flow.down(size * leading)
    }
  }

  private heading(flow: Flow, text: string): void {
    flow.ensure(12 * leading + 3 * tableSize * leading)
    this.paragraph(flow, text, this.bold, 12, this.palette.maroon)
    flow.down(4)
  }

  private fieldLine(flow: Flow, name: string, value: string): void {
    const nameWidth = 150
    const valueWidth = letterPortrait[0] - 2 * margin - nameWidth
    const lines = wrap(value, this.regular, bodySize, valueWidth)
    lines.forEach((line, index) => {
      flow.ensure(bodySize * leading)
      if (index === 0) {
        flow.text(name, margin, this.bold, bodySize, this.palette.grey)
      }
      flow.text(line, margin + nameWidth, this.regular, bodySize, this.palette.black)
      flow.down(bodySize * leading)
    })
  }

  /** A table: its header, repeated at the top of every page it continues on, then its rows. */
  private table(flow: Flow, columns: readonly Column[], rows: readonly string[][]): void {
    const header = () => {
      this.tableRow(
        flow,
        columns,
        columns.map((column) => column.title),
        this.bold,
        true,
      )
    }
    header()
    flow.continueWith(header)
    for (const row of rows) {
      this.tableRow(flow, columns, row, this.regular)
    }
  }

  /** A row whose cells wrap; a row taller than what is left of the page continues on the next. */
  private tableRow(
    flow: Flow,
    columns: readonly Column[],
    cells: readonly string[],
    font: PDFFont,
    isHeader = false,
  ): void {
    const padding = 4
    const lineHeight = tableSize * leading
    const wrapped = columns.map((column, index) =>
      wrap(cells[index] ?? '', font, tableSize, column.width - padding * 2),
    )
    const lineCount = Math.max(...wrapped.map((lines) => lines.length))
    const colour = isHeader ? this.palette.maroon : this.palette.black
    flow.ensure(Math.min(lineCount * lineHeight + padding * 2, flow.top - 2 * margin))
    flow.down(padding)
    for (let line = 0; line < lineCount; line += 1) {
      flow.ensure(lineHeight + padding)
      let x = margin
      for (const [index, column] of columns.entries()) {
        const text = wrapped[index]?.[line]
        if (text !== undefined && text !== '') {
          flow.text(text, x + padding, font, tableSize, colour)
        }
        x += column.width
      }
      flow.down(lineHeight)
    }
    flow.down(padding)
    flow.rule(isHeader ? this.palette.maroon : this.palette.rule, isHeader ? 1 : 0.5)
  }
}

function colourOf(colour: Colour) {
  return rgb(colour.red, colour.green, colour.blue)
}
