import fontkit from '@cantoo/fontkit'
import {
  clip,
  concatTransformationMatrix,
  degrees,
  endPath,
  PDFArray,
  PDFContentStream,
  PDFDict,
  PDFDocument,
  type PDFFont,
  type PDFImage,
  PDFName,
  PDFNumber,
  type PDFPage,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  scale,
} from '@cantoo/pdf-lib'
import boldFont from '../assets/fonts/NotoSans-Bold.ttf?inline'
import regularFont from '../assets/fonts/NotoSans-Regular.ttf?inline'
import logoImage from '../assets/mcscert-left-col.png?inline'
import type { CalendarDate } from '../domain/calendar-date.ts'
import type { Document } from '../domain/document.ts'
import type {
  ExpenseRow,
  LabelledDocument,
  Layout,
  Section,
  StampedExpense,
} from '../domain/layout.ts'
import type { DocumentsAsWritten } from './documents-as-written.ts'
import { formatOf } from './format.ts'
import { bytesOf } from './inlined.ts'
import type { Orientation } from './orientation.ts'
import { type Box, fitOf, type PageView, portraitRotationOf, viewOf } from './page-view.ts'
import type { Colour, Palette } from './palette.ts'
import { leaveOutWhatNoReaderShows } from './unseen-data.ts'

/** What the report document is written from. */
export interface Writing {
  readonly layout: Layout
  readonly palette: Palette
  /** The version of the system, written as the document's creator. */
  readonly version: string
  /** The date the document is written, under the cover's heading. */
  readonly writtenOn: CalendarDate
  /** What the report document holds of each document. */
  readonly documents: Pick<DocumentsAsWritten, 'imageOf' | 'pdfOf'>
}

const letterPortrait: [number, number] = [612, 792]
const letter = { width: letterPortrait[0], height: letterPortrait[1] }
/** Three-quarter-inch margins. */
const margin = 54
const stampBaseline = 24
const logoWidth = 170
const bodySize = 10
const tableSize = 9
const stampSize = 8
const titleSize = 18
/** The height of a capital of Noto Sans, as a share of its size. */
const capHeight = 0.714
const leading = 1.35
/** The space between a cell's text and its edges. */
const cellPadding = 4
/** The side of an expense's Entered box. */
const enteredSize = 10

/** A column of a table: its title and its width in points. */
interface Column {
  readonly title: string
  readonly width: number
}

/** A text of a table that is a link: to a document, or to an expense's row on the cover. */
interface LinkedText {
  readonly text: string
  readonly target: Target
}

/** A cell of a table: a text, or texts each on a line of its own and each a link. */
type Cell = string | readonly LinkedText[]

/** A line of a cell, and what it is a link to when it is one. */
interface CellLine {
  readonly text: string
  readonly target?: Target
}

/** A name on the line of documents under an expense, and the label of the document it links to. */
/** What is written under a row: a document's name and its label, or a per diem's meals not claimed. */
interface NamedPiece {
  readonly name: string
  readonly label?: string | undefined
}

interface NamePiece {
  readonly text: string
  /** The label of the document a name links to; none for the meals of a per diem not claimed. */
  readonly label?: string | undefined
}

/** What separates two names on the line of documents under an expense. */
const nameSeparator = ' · '

/** A page of the report document, and the document it belongs to when it belongs to one. */
interface StampedPage {
  readonly page: PDFPage
  readonly entry?: LabelledDocument
}

/** A piece of a stamp; an expense in it is a link to the expense's row on the cover. */
interface StampPiece {
  readonly text: string
  readonly expense?: StampedExpense
}

const stampSeparator = ' · '

/** What a link goes to: the first page of a document, or the row of an expense on the cover. */
type Target = { readonly label: string } | { readonly expenseNumber: number }

/** A rectangle of a page that a reader clicks to go to a target. */
interface Link {
  readonly page: PDFPage
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly target: Target
}

/** Where a row starts: its page, and the height of its top on that page. */
interface Place {
  readonly page: PDFPage
  readonly top: number
}

/** A document ready for its pages: a PDF's pages copied, or an image to place on a page of its own. */
type Source =
  | { readonly pages: readonly PDFPage[]; readonly pageCount: number }
  | { readonly image: PDFImage; readonly orientation: Orientation; readonly pageCount: 1 }

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
  // Every document is read, its pages copied and its image embedded first, all at once; the
  // pages are then added in the order of the report document.
  const sources = await Promise.all(
    writing.layout.sections.map((section) =>
      Promise.all(
        section.documents.map((entry) => sourceOf(pdf, entry.document, writing.documents)),
      ),
    ),
  )
  writer.writeCover(writing.layout, writing.writtenOn)
  writing.layout.sections.forEach((section, index) => {
    writer.writeSection(section, sources[index] ?? [])
  })
  writer.stampEveryPage()
  writer.link()
  pdf.setTitle(writing.layout.title)
  pdf.setAuthor(writing.layout.author)
  pdf.setCreator(`McSCert Expense Report v${writing.version}`)
  pdf.setProducer(`McSCert Expense Report v${writing.version}`)
  // The Entered boxes are drawn when added; updating them on saving would embed a font of its own.
  return pdf.save({ updateFieldAppearances: false })
}

/** A document ready to go into the report document: its pages copied, or its image embedded. */
async function sourceOf(
  pdf: PDFDocument,
  document: Document,
  documents: Writing['documents'],
): Promise<Source> {
  if (formatOf(document.content) !== 'pdf') {
    const { content, format, orientation } = await documents.imageOf(document)
    const image = format === 'png' ? await pdf.embedPng(content) : await pdf.embedJpg(content)
    return { image, orientation, pageCount: 1 }
  }
  const source = await PDFDocument.load(await documents.pdfOf(document))
  leaveOutWhatNoReaderShows(source)
  const pages = await pdf.copyPages(source, source.getPageIndices())
  return { pages, pageCount: pages.length }
}

/**
 * The lines a text wraps into within a width, breaking a word longer than the width; each of its
 * own line breaks starts a line.
 */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const fits = (candidate: string) => font.widthOfTextAtSize(candidate, size) <= width
  return text.split('\n').flatMap((paragraph) => wrapParagraph(paragraph, fits))
}

/** The lines a paragraph wraps into, filling each line with as many pieces of words as fit. */
function wrapParagraph(paragraph: string, fits: (text: string) => boolean): string[] {
  const pieces = paragraph
    .split(/\s+/)
    .filter((word) => word !== '')
    .flatMap((word) => breakWord(word, fits))
  const lines: string[] = []
  let line = ''
  for (const piece of pieces) {
    const candidate = line === '' ? piece : `${line} ${piece}`
    if (fits(candidate) || line === '') {
      line = candidate
    } else {
      lines.push(line)
      line = piece
    }
  }
  lines.push(line)
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
  private current: PDFPage | undefined
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

  /** The page being written; absent when only counting. */
  get page(): PDFPage | undefined {
    return this.current
  }

  /** The height the next line starts at. */
  get cursor(): number {
    return this.y
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
    this.current?.drawText(text, { x, y: this.y - size, size, font, color: colourOf(colour) })
  }

  rule(colour: Colour, thickness: number): void {
    this.current?.drawLine({
      start: { x: margin, y: this.y },
      end: { x: letterPortrait[0] - margin, y: this.y },
      thickness,
      color: colourOf(colour),
    })
  }

  box(x: number, size: number, colour: Colour, isTicked: boolean): void {
    const page = this.current
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
    this.current = this.isCounting ? undefined : this.writer.addGeneratedPage()
    this.y = this.top
    const logoHeight = (logoWidth * this.writer.logo.height) / this.writer.logo.width
    this.current?.drawImage(this.writer.logo, {
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
  private readonly links: Link[] = []
  private readonly firstPages = new Map<string, PDFPage>()
  private readonly expenseRows = new Map<number, Place>()
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
    this.pages.push({ page })
    return page
  }

  writeCover(layout: Layout, writtenOn: CalendarDate): void {
    const flow = new Flow(this, false)
    if (flow.page !== undefined) {
      this.heading(flow.page, writtenOn)
    }
    for (const field of layout.coverFields) {
      this.fieldLine(flow, field.name, field.value)
    }
    flow.down(12)
    this.sectionHeading(flow, 'Attached information')
    for (const information of layout.attachedInformation) {
      const height = bodySize * leading
      flow.ensure(height)
      flow.box(margin, bodySize, this.palette.black, information.isAttached)
      flow.text(information.kind.plural, margin + 18, this.regular, bodySize, this.palette.black)
      flow.down(height)
    }
    flow.down(12)
    this.sectionHeading(flow, 'Expenses')
    const columns: Column[] = [
      { title: '#', width: 22 },
      { title: 'Date', width: 62 },
      { title: 'Description', width: 220 },
      { title: 'Foreign amount', width: 76 },
      { title: 'Claimed (CAD)', width: 76 },
      { title: 'Entered', width: 48 },
    ]
    this.table(flow, columns, [])
    for (const row of layout.expenses) {
      const cells = [
        String(row.number),
        row.date,
        row.description,
        row.foreignAmount,
        row.claimedAmount,
        '',
      ]
      // An expense and the first line of its documents start on the same page, unless the
      // expense alone is taller than a page.
      const height = this.rowHeight(columns, cells, this.regular) + tableSize * leading + 4
      flow.ensure(Math.min(height, flow.top - 2 * margin))
      const place = this.tableRow(flow, columns, cells, this.regular, false, false)
      if (place !== undefined) {
        this.expenseRows.set(row.number, place)
        this.enteredBox(row, place, columns)
      }
      const under =
        row.mealsNotClaimed === '' ? row.supportingDocuments : [{ name: row.mealsNotClaimed }]
      this.documentsLine(flow, under, columns)
    }
    this.tableRow(flow, columns, ['', '', 'Total', '', layout.total.join('\n'), ''], this.bold)
    flow.stopContinuing()
  }

  /**
   * The Entered box of an expense, in the last column of its row: an empty form field a reader
   * ticks on screen, or by hand on a printed copy.
   */
  private enteredBox(row: ExpenseRow, place: Place, columns: readonly Column[]): void {
    const last = columns.at(-1)
    const left = margin + columns.slice(0, -1).reduce((sum, column) => sum + column.width, 0)
    const box = this.pdf.getForm().createCheckBox(`Entered, expense ${row.number}`)
    box.addToPage(place.page, {
      x: left + ((last?.width ?? 0) - enteredSize) / 2,
      y: place.top - 4 - enteredSize,
      width: enteredSize,
      height: enteredSize,
      textColor: colourOf(this.palette.maroon),
      backgroundColor: colourOf(this.palette.white),
      borderColor: colourOf(this.palette.black),
      borderWidth: 0.75,
    })
  }

  writeSection(section: Section, sources: readonly Source[]): void {
    const counting = new Flow(this, true)
    this.sectionPage(counting, section, sources, 0)
    const firstPage = this.pages.length + counting.pageCount + 1
    this.sectionPage(new Flow(this, false), section, sources, firstPage)
    for (const [index, entry] of section.documents.entries()) {
      const source = sources[index]
      if (source !== undefined) {
        this.copy(entry, source)
      }
    }
  }

  /**
   * Stamps every page: the label of its document, the name of an additional document, and each
   * expense a document supports, by its number and the start of its description, a link to the
   * expense's row on the cover; then the page number out of the total. When the stamp is wider than the page less its margins, the expenses go on
   * lines of their own above it.
   */
  stampEveryPage(): void {
    const total = this.pages.length
    this.pages.forEach(({ page, entry }, index) => {
      const view = viewOf(page.getCropBox(), page.getRotation().angle)
      const room = view.width - 2 * margin
      const label: StampPiece[] = entry === undefined ? [] : [{ text: entry.label }]
      const name: StampPiece[] =
        entry?.stampedName === undefined ? [] : [{ text: entry.stampedName }]
      const expenses = (entry?.expenses ?? []).map((expense) => ({ text: expense.name, expense }))
      const pageNumber = { text: `${index + 1} / ${total}` }
      const oneLine = [...label, ...name, ...expenses, pageNumber]
      const lines =
        this.widthOf(oneLine) <= room
          ? [oneLine]
          : [
              ...expenses.flatMap(({ text, expense }) =>
                wrap(text, this.regular, stampSize, room).map((part) => [{ text: part, expense }]),
              ),
              [...label, ...name, pageNumber],
            ]
      lines.toReversed().forEach((line, height) => {
        this.stampLine(page, view, line, stampBaseline + height * stampSize * leading)
      })
    })
  }

  private widthOf(line: readonly StampPiece[]): number {
    const text = line.map((piece) => piece.text).join(stampSeparator)
    return this.regular.widthOfTextAtSize(text, stampSize)
  }

  /**
   * A line of a stamp, upright on screen whatever the page's rotation, ending at the right margin
   * of the page as it shows; each expense in it a link to its row on the cover.
   */
  private stampLine(page: PDFPage, view: PageView, line: readonly StampPiece[], up: number): void {
    const left = view.width - margin - this.widthOf(line)
    const text = line.map((piece) => piece.text).join(stampSeparator)
    const at = view.toPage(left, up)
    page.drawText(text, {
      ...at,
      size: stampSize,
      font: this.regular,
      color: colourOf(this.palette.grey),
      rotate: degrees(view.rotation),
    })
    line.forEach((piece, index) => {
      if (piece.expense === undefined) return
      const before = line
        .slice(0, index)
        .map((each) => each.text + stampSeparator)
        .join('')
      const box = view.boxOnPage({
        x: left + this.regular.widthOfTextAtSize(before, stampSize),
        y: up - 2,
        width: this.regular.widthOfTextAtSize(piece.text, stampSize),
        height: stampSize + 3,
      })
      this.links.push({ page, ...box, target: { expenseNumber: piece.expense.number } })
    })
  }

  /** Adds every link, now that every page of the report document exists. */
  link(): void {
    const context = this.pdf.context
    for (const link of this.links) {
      const target = link.target
      let destination: PDFArray | undefined
      if ('label' in target) {
        const page = this.firstPages.get(target.label)
        destination = page && context.obj([page.ref, 'Fit'])
      } else {
        const row = this.expenseRows.get(target.expenseNumber)
        destination = row && context.obj([row.page.ref, 'XYZ', null, row.top, null])
      }
      if (destination === undefined) continue
      const annotation = context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [link.x, link.y, link.x + link.width, link.y + link.height],
        Border: [0, 0, 0],
        Dest: destination,
      })
      link.page.node.addAnnot(context.register(annotation))
    }
  }

  private sectionPage(
    flow: Flow,
    section: Section,
    sources: readonly Source[],
    firstPage: number,
  ): void {
    this.paragraph(flow, section.title, this.bold, 16, this.palette.maroon)
    flow.down(6)
    const expenses: Column = { title: 'Expenses', width: 184 }
    const columns: Column[] = [
      { title: 'Label', width: 50 },
      { title: 'Name', width: section.listsExpenses ? 210 : 210 + expenses.width },
      { title: 'Pages', width: 60 },
      ...(section.listsExpenses ? [expenses] : []),
    ]
    let page = firstPage
    const pagesOf = new Map(
      section.documents.map((entry, index) => {
        const count = sources[index]?.pageCount ?? 1
        const pages = count === 1 ? String(page) : `${page}–${page + count - 1}`
        page += count
        return [entry, pages] as const
      }),
    )
    const groups =
      section.subsections.length > 0
        ? section.subsections
        : [{ title: undefined, documents: section.documents }]
    groups.forEach(({ title, documents }, index) => {
      if (index > 0) flow.down(12)
      if (title !== undefined) this.sectionHeading(flow, title)
      const rows = documents.map((entry): Cell[] => [
        entry.label,
        entry.document.name,
        pagesOf.get(entry) ?? '',
        entry.expenses.map(({ number, description }) => ({
          text: description,
          target: { expenseNumber: number },
        })),
      ])
      this.table(flow, columns, rows)
      flow.stopContinuing()
    })
  }

  private copy(entry: LabelledDocument, source: Source): void {
    if ('pages' in source) {
      for (const page of source.pages) {
        this.pages.push({ page: turnedPortrait(fittedToLetter(this.pdf.addPage(page))), entry })
      }
      this.markFirstPage(entry, this.pages.length - source.pages.length)
      return
    }
    // The image is placed as it is stored, on a page turned as its orientation says, within the
    // margins of a Letter page, so that the stamp never covers it.
    const { image, orientation } = source
    const box = { x: 0, y: 0, width: image.width, height: image.height }
    const fit = fitOf(box, orientation.turn, letter, margin)
    const page = this.pdf.addPage([fit.box.width, fit.box.height])
    const [x, width] = [-fit.box.x, image.width * fit.scale]
    if (orientation.isMirrored) {
      // Mirrored left to right, about the middle of the image.
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(-1, 0, 0, 1, 2 * x + width, 0),
      )
    }
    page.drawImage(image, { x, y: -fit.box.y, width, height: image.height * fit.scale })
    if (orientation.isMirrored) {
      page.pushOperators(popGraphicsState())
    }
    page.setRotation(degrees(orientation.turn))
    this.pages.push({ page: turnedPortrait(page), entry })
    this.markFirstPage(entry, this.pages.length - 1)
  }

  private markFirstPage(entry: LabelledDocument, index: number): void {
    const first = this.pages[index]?.page
    if (first !== undefined) {
      this.firstPages.set(entry.label, first)
    }
  }

  private paragraph(flow: Flow, text: string, font: PDFFont, size: number, colour: Colour): void {
    for (const line of wrap(text, font, size, letterPortrait[0] - 2 * margin)) {
      flow.ensure(size * leading)
      flow.text(line, margin, font, size, colour)
      flow.down(size * leading)
    }
  }

  /**
   * The cover's heading, in the top right corner, beside the logo: the title, its capitals level
   * with the logo's top, and the date it is written, on the logo's bottom.
   */
  private heading(page: PDFPage, writtenOn: CalendarDate): void {
    const right = letterPortrait[0] - margin
    const top = letterPortrait[1] - margin
    const logoHeight = (logoWidth * this.logo.height) / this.logo.width
    const lines = [
      {
        text: 'McSCert Expense Report',
        font: this.bold,
        size: titleSize,
        colour: this.palette.maroon,
      },
      { text: writtenOn.toString(), font: this.regular, size: bodySize, colour: this.palette.grey },
    ]
    const baselines = [top - titleSize * capHeight, top - logoHeight]
    lines.forEach(({ text, font, size, colour }, index) => {
      page.drawText(text, {
        x: right - font.widthOfTextAtSize(text, size),
        y: baselines[index] ?? top,
        size,
        font,
        color: colourOf(colour),
      })
    })
  }

  private sectionHeading(flow: Flow, text: string): void {
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
  private table(flow: Flow, columns: readonly Column[], rows: readonly Cell[][]): void {
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

  /**
   * A row whose cells wrap; a row taller than what is left of the page continues on the next.
   * A text that is a link starts a line of its own, each of its lines a link. A rule closes the
   * row unless something under it still belongs to it. Gives where the row starts.
   */
  private tableRow(
    flow: Flow,
    columns: readonly Column[],
    cells: readonly Cell[],
    font: PDFFont,
    isHeader = false,
    isClosed = true,
  ): Place | undefined {
    const padding = cellPadding
    const lineHeight = tableSize * leading
    const wrapped = this.cellsOf(columns, cells, font)
    const lineCount = Math.max(...wrapped.map((lines) => lines.length))
    const colour = isHeader ? this.palette.maroon : this.palette.black
    flow.ensure(Math.min(lineCount * lineHeight + padding * 2, flow.top - 2 * margin))
    const page = flow.page
    const place = page === undefined ? undefined : { page, top: flow.cursor }
    flow.down(padding)
    for (let line = 0; line < lineCount; line += 1) {
      flow.ensure(lineHeight + padding)
      let x = margin
      for (const [index, column] of columns.entries()) {
        this.cellLine(flow, wrapped[index]?.[line], x + padding, { font, colour })
        x += column.width
      }
      flow.down(lineHeight)
    }
    flow.down(padding)
    if (isClosed) {
      flow.rule(isHeader ? this.palette.maroon : this.palette.rule, isHeader ? 1 : 0.5)
    }
    return place
  }

  /** The lines each cell of a row wraps into, within its column. */
  private cellsOf(columns: readonly Column[], cells: readonly Cell[], font: PDFFont): CellLine[][] {
    return columns.map((column, index) =>
      linesOf(cells[index] ?? '', font, column.width - cellPadding * 2),
    )
  }

  /** The height of a row: its tallest cell, and the padding above and under it. */
  private rowHeight(columns: readonly Column[], cells: readonly Cell[], font: PDFFont): number {
    const lineCount = Math.max(...this.cellsOf(columns, cells, font).map((lines) => lines.length))
    return lineCount * tableSize * leading + 2 * cellPadding
  }

  /** A line of a cell, drawn at x, and a link when it is one; an empty line draws nothing. */
  private cellLine(
    flow: Flow,
    line: CellLine | undefined,
    x: number,
    { font, colour }: { readonly font: PDFFont; readonly colour: Colour },
  ): void {
    if (line === undefined || line.text === '') return
    flow.text(line.text, x, font, tableSize, colour)
    const page = flow.page
    if (page === undefined || line.target === undefined) return
    const width = font.widthOfTextAtSize(line.text, tableSize)
    const y = flow.cursor - tableSize - 2
    this.links.push({ page, x, y, width, height: tableSize + 3, target: line.target })
  }

  /**
   * The line under an expense's row: its documents by name, one after the other, from under its
   * description to its claimed amount, each a link to its document; a name that does not fit
   * goes on to the next line. Under a per diem, its meals not claimed, a link to nothing. A rule
   * closes the row.
   */
  private documentsLine(
    flow: Flow,
    documents: readonly NamedPiece[],
    columns: readonly Column[],
  ): void {
    const padding = 4
    const lineHeight = tableSize * leading
    const widths = columns.map((column) => column.width)
    const left = margin + (widths[0] ?? 0) + (widths[1] ?? 0) + padding
    const room = (widths[2] ?? 0) + (widths[3] ?? 0) + (widths[4] ?? 0) - 2 * padding
    const widthOf = (text: string) => this.regular.widthOfTextAtSize(text, tableSize)
    const lines: NamePiece[][] = []
    let used = 0
    for (const { label, name } of documents) {
      for (const text of wrap(name, this.regular, tableSize, room)) {
        const line = lines.at(-1)
        const needed = widthOf(nameSeparator) + widthOf(text)
        if (line === undefined || used + needed > room) {
          lines.push([{ text, label }])
          used = widthOf(text)
        } else {
          line.push({ text, label })
          used += needed
        }
      }
    }
    for (const line of lines) {
      flow.ensure(lineHeight + padding)
      let x = left
      line.forEach(({ text, label }, index) => {
        if (index > 0) {
          flow.text(nameSeparator, x, this.regular, tableSize, this.palette.grey)
          x += widthOf(nameSeparator)
        }
        flow.text(text, x, this.regular, tableSize, this.palette.grey)
        const page = flow.page
        if (page !== undefined && label !== undefined) {
          const y = flow.cursor - tableSize - 2
          this.links.push({
            page,
            x,
            y,
            width: widthOf(text),
            height: tableSize + 3,
            target: { label },
          })
        }
        x += widthOf(text)
      })
      flow.down(lineHeight)
    }
    flow.down(padding)
    flow.rule(this.palette.rule, 0.5)
  }
}

/** The lines a cell wraps into within a width: a text that is a link starts a line of its own. */
function linesOf(cell: Cell, font: PDFFont, width: number): CellLine[] {
  if (typeof cell === 'string') {
    return wrap(cell, font, tableSize, width).map((text) => ({ text }))
  }
  const lines = cell.flatMap(({ text, target }) =>
    wrap(text, font, tableSize, width).map((part) => ({ text: part, target })),
  )
  return lines.length > 0 ? lines : [{ text: '' }]
}

/**
 * A page of a PDF document on a Letter page, portrait or landscape as it shows, as close to its
 * size as it can be: its content and annotations scaled down to fit the page when it is larger,
 * never enlarged, and centred; a Letter page stays as it is. What its crop box hid stays hidden.
 */
function fittedToLetter(page: PDFPage): PDFPage {
  const crop = page.getCropBox()
  const fit = fitOf(crop, page.getRotation().angle, letter, 0)
  const context = page.doc.context
  const stream = (...operators: Parameters<typeof PDFContentStream.of>[1]) =>
    context.register(PDFContentStream.of(context.obj({}), operators))
  page.node.normalize()
  page.node.wrapContentStreams(
    stream(
      pushGraphicsState(),
      rectangle(
        crop.x * fit.scale,
        crop.y * fit.scale,
        crop.width * fit.scale,
        crop.height * fit.scale,
      ),
      clip(),
      endPath(),
      scale(fit.scale, fit.scale),
    ),
    stream(popGraphicsState()),
  )
  withoutHiddenAnnotations(page, crop)
  page.scaleAnnotations(fit.scale, fit.scale)
  const { x, y, width, height } = fit.box
  for (const setBox of [
    page.setMediaBox,
    page.setCropBox,
    page.setBleedBox,
    page.setTrimBox,
    page.setArtBox,
  ]) {
    setBox.call(page, x, y, width, height)
  }
  return page
}

/**
 * Takes out of a page the annotations wholly outside its crop box, which it hid and a Letter page
 * would show: a comment, a link or a form field cropped away.
 */
function withoutHiddenAnnotations(page: PDFPage, crop: Box): void {
  const annotations = page.node.Annots()
  for (let index = (annotations?.size() ?? 0) - 1; index >= 0; index -= 1) {
    const rect = annotations?.lookupMaybe(index, PDFDict)?.lookupMaybe(PDFName.of('Rect'), PDFArray)
    const [left, bottom, right, top] = [0, 1, 2, 3].map(
      (corner) => rect?.lookupMaybe(corner, PDFNumber)?.asNumber() ?? Number.NaN,
    ) as [number, number, number, number]
    const isHidden =
      Math.max(left, right) <= crop.x ||
      Math.min(left, right) >= crop.x + crop.width ||
      Math.max(bottom, top) <= crop.y ||
      Math.min(bottom, top) >= crop.y + crop.height
    if (isHidden) annotations?.remove(index)
  }
}

/** The page, turned a quarter when it would show landscape: every page shows portrait. */
function turnedPortrait(page: PDFPage): PDFPage {
  page.setRotation(degrees(portraitRotationOf(page.getCropBox(), page.getRotation().angle)))
  return page
}

function colourOf(colour: Colour) {
  return rgb(colour.red, colour.green, colour.blue)
}
