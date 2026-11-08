import type { PDFFont, PDFImage, PDFPage } from '@cantoo/pdf-lib'
import type { MissingReceiptAuthorization } from '../domain/layout.ts'
import { colourOf, letterPortrait, margin, wrap } from './generated-page.ts'
import type { Colour } from './palette.ts'

/** What a missing receipt authorization is drawn with. */
export interface FormMeans {
  readonly regular: PDFFont
  readonly bold: PDFFont
  readonly logo: PDFImage
  readonly black: Colour
}

/** Something drawn on a page of a form. */
type Drawing = (page: PDFPage) => void

/** What a page of a form holds. */
export type FormPage = readonly Drawing[]

/** A piece of a paragraph, in one font. */
interface Run {
  readonly text: string
  readonly font: PDFFont
}

/** A field on a line: its name, where its line runs, and its value. */
interface FormField {
  readonly name?: string
  /** Where its name starts; it ends where its line starts when it does not say. */
  readonly nameStart?: number
  readonly lineStart: number
  readonly lineEnd: number
  /** The lines its value is written on. */
  readonly lines: readonly string[]
}

const textSize = 10
const titleSize = 13
const paragraphHeight = 13.5
const logoWidth = 110
const lineThickness = 0.75
const frameThickness = 1
/** The space between a frame and the text it holds. */
const framePadding = 5
/** The space between the bottom of a frame and the last line it holds. */
const frameClosing = 12
/** The space between the start of a line and the value it holds. */
const valueInset = framePadding
/** The space between a line and the text written on it. */
const baselineLift = 3
/** The height of the lines of a value that runs on, and of the first line of a field. */
const lineHeight = 17
const fieldHeight = 28
const signatureHeight = 32
const partGap = 12
/** What is kept of the spare height, so that rounding never sends the last line to another page. */
const roundingRoom = 0.01

const frameLeft = margin
const frameRight = letterPortrait[0] - margin
const frameTop = letterPortrait[1] - margin
const pageMiddle = letterPortrait[0] / 2
const textLeft = frameLeft + framePadding
const textWidth = frameRight - frameLeft - 2 * framePadding
/** Where the lines of the fields of the third part start, and of those of the fourth. */
const fieldStart = frameLeft + 60
const signatureStart = frameLeft + 125
const descriptionStart = frameLeft + 145
const amountName = frameLeft + 240
const amountStart = frameLeft + 285
const extensionEnd = frameLeft + 145
const emailName = frameLeft + 155
const emailStart = frameLeft + 190

/**
 * The lines a text wraps into when its first line is narrower than the others, as a value that
 * starts next to the name of its field and runs on across the frame.
 */
function wrapAfterName(
  text: string,
  font: PDFFont,
  firstWidth: number,
  width: number,
): readonly string[] {
  const [head = '', ...others] = text.split('\n')
  const words = head.trim().split(/\s+/).join(' ')
  const [first = ''] = wrap(words, font, textSize, firstWidth)
  const remainder = words.slice(first.length).trim()
  const rest = remainder === '' ? others : [remainder, ...others]
  return rest.length === 0 ? [first] : [first, ...wrap(rest.join('\n'), font, textSize, width)]
}

/** At least as many lines as asked, the ones a value leaves being empty. */
function atLeast(lines: readonly string[], count: number): readonly string[] {
  return [...lines, ...Array.from({ length: Math.max(0, count - lines.length) }, () => '')]
}

/** The lines a paragraph of runs wraps into, each its runs, the words of a font kept together. */
function wrapRuns(runs: readonly Run[], width: number): readonly (readonly Run[])[] {
  const lines: Run[][] = [[]]
  let used = 0
  for (const { text, font } of runs) {
    for (const word of text.split(' ').filter((each) => each !== '')) {
      const line = lines.at(-1) ?? []
      const wordWidth = font.widthOfTextAtSize(word, textSize)
      const space = line.length === 0 ? 0 : font.widthOfTextAtSize(' ', textSize)
      if (line.length > 0 && used + space + wordWidth > width) {
        lines.push([{ text: word, font }])
        used = wordWidth
      } else {
        const last = line.at(-1)
        if (last?.font === font) {
          line[line.length - 1] = { text: `${last.text} ${word}`, font }
        } else {
          line.push({ text: word, font })
        }
        used += space + wordWidth
      }
    }
  }
  return lines
}

/** A word of a justified line, and how far along the line it starts. */
export interface PlacedWord extends Run {
  readonly offset: number
}

/**
 * The words of a line, spread so that its first starts it and its last ends it, across a width: the
 * spaces between them all alike.
 */
export function justified(line: readonly Run[], width: number): readonly PlacedWord[] {
  const words = line.flatMap(({ text, font }) =>
    text.split(' ').map((word): Run => ({ text: word, font })),
  )
  const widths = words.map(({ text, font }) => font.widthOfTextAtSize(text, textSize))
  const space =
    (width - widths.reduce((sum, each) => sum + each, 0)) / Math.max(1, words.length - 1)
  let offset = 0
  return words.map((word, index) => {
    const placed = { ...word, offset }
    offset += (widths[index] ?? 0) + space
    return placed
  })
}

/**
 * The form being laid out, page after page, its frame closing where a page ends. Its gaps and its
 * lines are as high as asked, the text of its paragraphs staying as it is.
 */
class FormFlow {
  readonly pages: Drawing[][] = [[]]
  /** The height of its gaps and its lines, before they are made higher. */
  stretchableHeight = 0
  private y = frameTop
  private readonly means: FormMeans
  private readonly stretch: number

  constructor(means: FormMeans, stretch: number) {
    this.means = means
    this.stretch = stretch
  }

  /** The height left on the page under its frame, down to the bottom margin. */
  get spareHeight(): number {
    return this.y - frameClosing - margin
  }

  /** A height of a gap or a line, once made higher, counted. */
  private stretched(height: number): number {
    this.stretchableHeight += height
    return height * this.stretch
  }

  /** A gap, as high as asked. */
  gap(height: number): void {
    this.down(this.stretched(height))
  }

  private get drawings(): Drawing[] {
    return this.pages.at(-1) ?? []
  }

  /** The room a page offers, within its frame. */
  get pageRoom(): number {
    return frameTop - margin - frameClosing
  }

  /** Room for a height, on this page, or the next once its frame is closed. */
  ensure(height: number): void {
    if (this.y - height < margin + frameClosing) {
      this.closeFrame()
      this.pages.push([])
      this.y = frameTop
    }
  }

  down(height: number): void {
    this.y -= height
  }

  /** The logo on the left, and the title centred and underlined, level with its bottom. */
  heading(title: string): void {
    const { logo, bold } = this.means
    const height = (logoWidth * logo.height) / logo.width
    const bottom = frameTop - framePadding - height
    this.drawings.push((page) => {
      page.drawImage(logo, { x: textLeft, y: bottom, width: logoWidth, height })
    })
    const width = bold.widthOfTextAtSize(title, titleSize)
    const start = pageMiddle - width / 2
    this.write(title, start, bottom, bold, titleSize)
    this.rule(start, start + width, bottom - 2)
    this.y = bottom
    this.gap(partGap)
  }

  /** A paragraph of runs across the frame, every line but its last ending at the frame's edge. */
  justifiedParagraph(runs: readonly Run[]): void {
    const lines = wrapRuns(runs, textWidth)
    lines.forEach((line, index) => {
      if (index === lines.length - 1) {
        this.line(line)
        return
      }
      this.ensure(paragraphHeight)
      this.down(paragraphHeight)
      for (const { text, font, offset } of justified(line, textWidth)) {
        this.write(text, textLeft + offset, this.y + baselineLift, font, textSize)
      }
    })
  }

  /** A paragraph of runs across the frame. */
  paragraph(runs: readonly Run[]): void {
    for (const line of wrapRuns(runs, textWidth)) {
      this.line(line)
    }
  }

  /** A line of runs, from the left of the frame. */
  private line(line: readonly Run[]): void {
    this.ensure(paragraphHeight)
    this.down(paragraphHeight)
    let x = textLeft
    for (const { text, font } of line) {
      this.write(text, x, this.y + baselineLift, font, textSize)
      x += font.widthOfTextAtSize(`${text} `, textSize)
    }
  }

  /** A line of text, centred. */
  centred(text: string, font: PDFFont): void {
    this.ensure(paragraphHeight)
    this.down(paragraphHeight)
    const start = pageMiddle - font.widthOfTextAtSize(text, textSize) / 2
    this.write(text, start, this.y + baselineLift, font, textSize)
  }

  /** A rule across the frame, under what was written. */
  partRule(): void {
    this.rule(frameLeft, frameRight, this.y)
  }

  /**
   * Fields on one line, each name on its first, each value on as many lines as it needs, each line
   * drawn; the lines after the first lower than it by a line's height.
   */
  fields(fields: readonly FormField[], firstHeight: number): void {
    const { regular, bold } = this.means
    const count = Math.max(...fields.map(({ lines }) => lines.length))
    for (let index = 0; index < count; index += 1) {
      const height = this.stretched(index === 0 ? firstHeight : lineHeight)
      this.ensure(height)
      this.down(height)
      for (const field of fields) {
        if (index === 0 && field.name !== undefined) {
          const start =
            field.nameStart ??
            field.lineStart - baselineLift - regular.widthOfTextAtSize(field.name, textSize)
          this.write(field.name, start, this.y + baselineLift, regular, textSize)
        }
        const value = field.lines[index] ?? ''
        if (value !== '') {
          this.write(value, field.lineStart + valueInset, this.y + baselineLift, bold, textSize)
        }
        this.rule(field.lineStart, field.lineEnd, this.y)
      }
    }
  }

  /** Closes the frame of the page, a little under what was written. */
  closeFrame(): void {
    const bottom = this.y - frameClosing
    const { black } = this.means
    this.drawings.push((page) => {
      page.drawRectangle({
        x: frameLeft,
        y: bottom,
        width: frameRight - frameLeft,
        height: frameTop - bottom,
        borderColor: colourOf(black),
        borderWidth: frameThickness,
      })
    })
  }

  private write(text: string, x: number, y: number, font: PDFFont, size: number): void {
    const { black } = this.means
    this.drawings.push((page) => {
      page.drawText(text, { x, y, size, font, color: colourOf(black) })
    })
  }

  private rule(start: number, end: number, y: number): void {
    const { black } = this.means
    this.drawings.push((page) => {
      page.drawLine({
        start: { x: start, y },
        end: { x: end, y },
        thickness: lineThickness,
        color: colourOf(black),
      })
    })
  }
}

/**
 * The pages of a missing receipt authorization, which reproduces McMaster's form, filled in: on
 * one page when it fits, its frame running down to the bottom margin, the spare height shared among
 * its gaps and its lines. A value wraps over as many lines as it needs. A form longer than a page
 * continues on the next one, in a frame of its own, and the certification and the signature lines
 * stay together on its last page, so that what is signed is under the signature.
 */
export function formPagesOf(
  authorization: MissingReceiptAuthorization,
  means: FormMeans,
): readonly FormPage[] {
  const flow = formFlowOf(authorization, means, 1)
  if (flow.pages.length > 1) return flow.pages
  const stretch = 1 + (flow.spareHeight - roundingRoom) / flow.stretchableHeight
  return formFlowOf(authorization, means, stretch).pages
}

/** The form laid out, its gaps and its lines made higher by a factor. */
function formFlowOf(
  authorization: MissingReceiptAuthorization,
  means: FormMeans,
  stretch: number,
): FormFlow {
  const { regular, bold } = means
  const flow = new FormFlow(means, stretch)
  flow.heading('Missing Receipt Authorization Form')
  flow.justifiedParagraph([
    { text: 'Original invoices', font: bold },
    {
      text: 'on company letterhead or official receipts are required for reimbursements. Where the original invoice or receipt is not issued or lost, then a copy of the official invoice or receipt or a credit card statement will be accepted as a substitute with a brief explanation and notation of "original lost" clearly indicated on the substituting support.',
      font: regular,
    },
  ])
  flow.gap(partGap)
  flow.partRule()
  flow.gap(partGap / 2)
  flow.centred('EXPLANATORY NOTE', bold)
  flow.gap(partGap / 2)
  flow.paragraph([
    { text: 'Please accept this as proof of expenditure for the missing', font: regular },
    { text: 'original', font: bold },
    { text: 'receipt.', font: regular },
  ])
  flow.gap(partGap / 2)
  flow.paragraph([
    { text: 'Reason for missing original receipt or boarding pass(es):', font: regular },
  ])
  const across = frameRight - frameLeft - 2 * valueInset
  flow.fields(
    [
      {
        lineStart: frameLeft,
        lineEnd: frameRight,
        lines: atLeast(wrap(authorization.reason, bold, textSize, across), 4),
      },
    ],
    lineHeight,
  )
  const onLine = (value: string, lineStart: number, lineEnd = frameRight) =>
    wrap(value, bold, textSize, lineEnd - lineStart - 2 * valueInset)
  flow.fields(
    [
      {
        name: 'Paid to:',
        nameStart: textLeft,
        lineStart: fieldStart,
        lineEnd: frameRight,
        lines: onLine(authorization.paidTo, fieldStart),
      },
    ],
    fieldHeight,
  )
  flow.fields(
    [
      {
        name: 'Dated:',
        nameStart: textLeft,
        lineStart: fieldStart,
        lineEnd: amountName - valueInset,
        lines: onLine(authorization.dated, fieldStart, amountName - valueInset),
      },
      {
        name: 'Amount:',
        nameStart: amountName,
        lineStart: amountStart,
        lineEnd: frameRight,
        lines: onLine(authorization.amount, amountStart),
      },
    ],
    fieldHeight,
  )
  const description = wrapAfterName(
    authorization.description,
    bold,
    frameRight - descriptionStart - 2 * valueInset,
    across,
  )
  const [firstLine = '', ...nextLines] = atLeast(description, 3)
  flow.fields(
    [
      {
        name: 'Description of Expense(s):',
        nameStart: textLeft,
        lineStart: descriptionStart,
        lineEnd: frameRight,
        lines: [firstLine],
      },
    ],
    fieldHeight,
  )
  flow.fields([{ lineStart: frameLeft, lineEnd: frameRight, lines: nextLines }], lineHeight)
  const certification = [
    {
      text: 'I certify that this expense has not and will not be claimed for reimbursement from other sources or institutions.',
      font: bold,
    },
  ]
  const printedName = onLine(authorization.printedName, signatureStart)
  const title = onLine(authorization.title, signatureStart)
  const extension = onLine(authorization.extension, fieldStart, extensionEnd)
  const email = onLine(authorization.email, emailStart)
  const certificationHeight = wrapRuns(certification, textWidth).length * paragraphHeight
  const runsOn = (lines: readonly string[], height: number) =>
    height + (lines.length - 1) * lineHeight
  flow.ensure(
    Math.min(
      flow.pageRoom,
      partGap +
        certificationHeight +
        signatureHeight +
        runsOn(printedName, fieldHeight) +
        runsOn(title, fieldHeight) +
        runsOn(extension.length > email.length ? extension : email, fieldHeight),
    ),
  )
  flow.gap(partGap / 2)
  flow.paragraph(certification)
  const signatureLine = (name: string, lines: readonly string[], height: number) =>
    flow.fields([{ name, lineStart: signatureStart, lineEnd: frameRight, lines }], height)
  signatureLine('Signature of Claimant:', [''], signatureHeight)
  signatureLine('Printed Name:', printedName, fieldHeight)
  signatureLine('Title:', title, fieldHeight)
  flow.fields(
    [
      {
        name: 'Extension:',
        nameStart: textLeft,
        lineStart: fieldStart,
        lineEnd: extensionEnd,
        lines: extension,
      },
      {
        name: 'Email:',
        nameStart: emailName,
        lineStart: emailStart,
        lineEnd: frameRight,
        lines: email,
      },
    ],
    fieldHeight,
  )
  flow.closeFrame()
  return flow
}
