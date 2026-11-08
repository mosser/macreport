import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  type PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  type PDFRef,
} from '@cantoo/pdf-lib'
import { ContentScanner, type Token } from './content-scanner.ts'

/** The decimals a shape keeps: 0.01 point, a seven-thousandth of an inch. */
const decimals = 2
/** Below this many bytes, drawing a shape from elsewhere takes as many as drawing it. */
const shortestSharedShape = 40
const namePrefix = 'McS'
const paddingOfBox = 1

/** How many coordinates each operator that builds a path takes. */
const coordinateCounts: Readonly<Record<string, number>> = { m: 2, l: 2, c: 6, v: 4, y: 4, re: 4 }
const fillOperators: ReadonlySet<string> = new Set(['f', 'F', 'f*'])
/** The operators that paint a path or drop it: nothing else ends one. */
const pathEndingOperators: ReadonlySet<string> = new Set([
  ...fillOperators,
  'B',
  'B*',
  'b',
  'b*',
  'S',
  's',
  'n',
])
/** The operators that set a colour that is no pattern; `scn` is one unless it ends with a name. */
const plainColourOperators: ReadonlySet<string> = new Set(['cs', 'sc', 'g', 'rg', 'k'])

/** How much the current transform can stretch a distance, and whether the fill is a pattern. */
interface GraphicsState {
  /** The transform, without its translation, as a, b, c and d. */
  readonly transform: readonly [number, number, number, number]
  readonly isFilledWithPattern: boolean
}

/** A path being built: where it starts, and each operator of it, relative to its first point. */
interface PathInProgress {
  readonly start: number
  readonly x: number
  readonly y: number
  readonly segments: string[]
  readonly xs: number[]
  readonly ys: number[]
}

/** A filled shape of a page: where it sits in the stream, what it draws, and where. */
interface Shape {
  readonly start: number
  readonly end: number
  readonly key: string
  readonly x: number
  readonly y: number
  readonly box: readonly [number, number, number, number]
}

/** A page's content stream and the shapes found in it. */
interface ScannedPage {
  readonly node: ReturnType<PDFDocument['getPages']>[number]['node']
  readonly content: Uint8Array
  readonly shapes: readonly Shape[]
}

/** A number as a content stream writes it, at 0.01 point, without what it does not need. */
function numberText(value: number): string {
  return String(Number(value.toFixed(decimals)))
}

/** The transform after a `cm`: the matrix given, then the current one. */
function concatenated(
  [a, b, c, d]: readonly number[],
  { transform }: GraphicsState,
): GraphicsState['transform'] {
  const [e, f, g, h] = transform
  return [
    (a ?? 0) * e + (b ?? 0) * g,
    (a ?? 0) * f + (b ?? 0) * h,
    (c ?? 0) * e + (d ?? 0) * g,
    (c ?? 0) * f + (d ?? 0) * h,
  ]
}

/** Whether a transform stretches any distance, so that 0.01 point would become more. */
function isEnlarging([a, b, c, d]: GraphicsState['transform']): boolean {
  return Math.abs(a) + Math.abs(c) > 1 || Math.abs(b) + Math.abs(d) > 1
}

/** Finds the filled shapes of a content stream, tracking what decides if each can be shared. */
class ShapeFinder {
  private readonly scanner: ContentScanner
  private state: GraphicsState = { transform: [1, 0, 0, 1], isFilledWithPattern: false }
  private readonly saved: GraphicsState[] = []
  private operands: number[] = []
  private firstOperand: number | undefined
  private hasOtherOperand = false
  private endsWithName = false
  private path: PathInProgress | undefined
  /** Whether the path being built holds something unread: what paints it paints that too. */
  private isPathUnreadable = false
  /** Whether a text object is open: a form cannot be drawn inside one. */
  private isInTextObject = false
  private readonly shapes: Shape[] = []

  constructor(content: Uint8Array) {
    this.scanner = new ContentScanner(content)
  }

  /** The shapes of the stream, or nothing when it holds an inline image, whose bytes it cannot read. */
  find(): readonly Shape[] | undefined {
    for (let token = this.scanner.next(); token !== undefined; token = this.scanner.next()) {
      if (token.kind !== 'operator') {
        this.addOperand(token)
      } else if (token.text === 'BI') {
        return undefined
      } else {
        this.apply(token.text, token.end)
        this.operands = []
        this.firstOperand = undefined
        this.hasOtherOperand = false
        this.endsWithName = false
      }
    }
    return this.shapes
  }

  private addOperand(token: Token): void {
    this.firstOperand ??= token.start
    this.endsWithName = token.kind === 'name'
    if (token.kind === 'number') {
      this.operands.push(token.value)
    } else {
      this.hasOtherOperand = true
    }
  }

  private apply(operator: string, end: number): void {
    if (operator in coordinateCounts) {
      this.extendPath(operator)
    } else if (operator === 'h') {
      this.path?.segments.push('h')
    } else if (pathEndingOperators.has(operator)) {
      if (fillOperators.has(operator)) this.fill(operator, end)
      this.path = undefined
      this.isPathUnreadable = false
    } else {
      if (this.path !== undefined) this.isPathUnreadable = true
      this.path = undefined
      this.changeState(operator)
    }
  }

  private changeState(operator: string): void {
    if (operator === 'BT' || operator === 'ET') {
      this.isInTextObject = operator === 'BT'
    } else if (operator === 'q') {
      this.saved.push(this.state)
    } else if (operator === 'Q') {
      this.state = this.saved.pop() ?? this.state
    } else if (operator === 'cm' && this.operands.length === 6) {
      this.state = { ...this.state, transform: concatenated(this.operands, this.state) }
    } else if (operator === 'scn' || plainColourOperators.has(operator)) {
      const isFilledWithPattern = operator === 'scn' && this.endsWithName
      this.state = { ...this.state, isFilledWithPattern }
    }
  }

  private extendPath(operator: string): void {
    if (this.isPathUnreadable) return
    const isValid = !this.hasOtherOperand && this.operands.length === coordinateCounts[operator]
    this.path = isValid ? (this.path ?? this.pathStartedBy(operator)) : undefined
    if (this.path === undefined) {
      this.isPathUnreadable = true
    } else {
      addSegment(this.path, operator, this.operands)
    }
  }

  private pathStartedBy(operator: string): PathInProgress | undefined {
    if (operator !== 'm' && operator !== 're') return undefined
    return {
      start: this.firstOperand ?? 0,
      x: this.operands[0] ?? 0,
      y: this.operands[1] ?? 0,
      segments: [],
      xs: [],
      ys: [],
    }
  }

  private fill(operator: string, end: number): void {
    const { path, state } = this
    const isUnsafe =
      this.isInTextObject || state.isFilledWithPattern || isEnlarging(state.transform)
    if (path === undefined || isUnsafe) return
    const paint = operator === 'f*' ? 'f*' : 'f'
    this.shapes.push({
      start: path.start,
      end,
      key: `${path.segments.join(' ')} ${paint}`,
      x: path.x,
      y: path.y,
      box: [
        Math.min(...path.xs) - paddingOfBox,
        Math.min(...path.ys) - paddingOfBox,
        Math.max(...path.xs) + paddingOfBox,
        Math.max(...path.ys) + paddingOfBox,
      ],
    })
  }
}

/** Adds an operator to a path, its coordinates relative to the path's first point. */
function addSegment(path: PathInProgress, operator: string, operands: readonly number[]): void {
  if (operator === 're') {
    const [x = 0, y = 0, width = 0, height = 0] = operands
    const [left, bottom] = [x - path.x, y - path.y]
    path.xs.push(left, left + width)
    path.ys.push(bottom, bottom + height)
    // Its size comes from its corners as written, so that the far one keeps to 0.01 point too.
    const sizeOfSide = (from: number, length: number) =>
      numberText(Number(numberText(from + length)) - Number(numberText(from)))
    path.segments.push(
      `${numberText(left)} ${numberText(bottom)} ${sizeOfSide(left, width)} ${sizeOfSide(bottom, height)} re`,
    )
    return
  }
  const relative = operands.map((value, index) => {
    const isX = index % 2 === 0
    const moved = value - (isX ? path.x : path.y)
    ;(isX ? path.xs : path.ys).push(moved)
    return numberText(moved)
  })
  path.segments.push(`${relative.join(' ')} ${operator}`)
}

/** Whether a page's unit makes it larger than its points, so that 0.01 point would become more. */
function isEnlargedPage(page: ScannedPage['node']): boolean {
  const unit = page.lookupMaybe(PDFName.of('UserUnit'), PDFNumber)?.asNumber()
  return unit !== undefined && unit > 1
}

/** The decoded bytes of a page's content, its streams one after the other; nothing if unreadable. */
function contentOf(page: ScannedPage['node'], pdf: PDFDocument): Uint8Array | undefined {
  const contents = pdf.context.lookup(page.get(PDFName.of('Contents')))
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((each) => pdf.context.lookup(each))
      : [contents]
  const parts: Uint8Array[] = []
  for (const stream of streams) {
    if (!(stream instanceof PDFRawStream)) return undefined
    parts.push(decodePDFRawStream(stream).decode(), new Uint8Array([10]))
  }
  return concatenatedBytes(parts)
}

function concatenatedBytes(parts: readonly Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    joined.set(part, offset)
    offset += part.length
  }
  return joined
}

/** The pages of a PDF that can be read, with their shapes. */
function scannedPagesOf(pdf: PDFDocument): ScannedPage[] {
  return pdf.getPages().flatMap(({ node }) => {
    if (isEnlargedPage(node)) return []
    try {
      const content = contentOf(node, pdf)
      const shapes = content === undefined ? undefined : new ShapeFinder(content).find()
      return content === undefined || shapes === undefined ? [] : [{ node, content, shapes }]
    } catch {
      // A filter the library cannot decode: the page stays as it is.
      return []
    }
  })
}

/** Each shape drawn more than once, and long enough to gain from it: its text, by how often. */
function sharedKeysOf(pages: readonly ScannedPage[]): ReadonlySet<string> {
  const counts = new Map<string, number>()
  for (const { shapes } of pages) {
    for (const { key } of shapes) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  const isShared = ([key, count]: [string, number]) =>
    count > 1 && key.length >= shortestSharedShape
  return new Set([...counts].filter(isShared).map(([key]) => key))
}

/** The names of the images and forms pages already use, which a shape's name must avoid. */
function namesInUse(pages: readonly ScannedPage[]): ReadonlySet<string> {
  const used = new Set<string>()
  for (const { node } of pages) {
    const objects = node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)
    for (const key of objects?.keys() ?? []) {
      used.add(key.decodeText())
    }
  }
  return used
}

/** Keeps each shape shared once, as a form, under a name no page uses. */
function formsOf(
  pages: readonly ScannedPage[],
  shared: ReadonlySet<string>,
  pdf: PDFDocument,
): ReadonlyMap<string, { readonly name: string; readonly reference: PDFRef }> {
  const used = namesInUse(pages)
  const forms = new Map<string, { readonly name: string; readonly reference: PDFRef }>()
  let index = 0
  for (const { shapes } of pages) {
    for (const { key, box } of shapes) {
      if (!shared.has(key) || forms.has(key)) continue
      while (used.has(`${namePrefix}${index}`)) index += 1
      const name = `${namePrefix}${index}`
      index += 1
      const stream = pdf.context.flateStream(key, {
        Type: 'XObject',
        Subtype: 'Form',
        BBox: [...box],
        Resources: {},
      })
      forms.set(key, { name, reference: pdf.context.register(stream) })
    }
  }
  return forms
}

const asciiBytes = (text: string) => new TextEncoder().encode(text)

/** A page's content with each shape shared drawn from its form; its other bytes stay as they were. */
function contentWithForms(
  { content, shapes }: ScannedPage,
  forms: ReturnType<typeof formsOf>,
): Uint8Array {
  const parts: Uint8Array[] = []
  let position = 0
  for (const { key, start, end, x, y } of shapes) {
    const form = forms.get(key)
    if (form !== undefined) {
      parts.push(
        content.subarray(position, start),
        asciiBytes(`q 1 0 0 1 ${numberText(x)} ${numberText(y)} cm /${form.name} Do Q`),
      )
      position = end
    }
  }
  parts.push(content.subarray(position))
  return concatenatedBytes(parts)
}

/**
 * Keeps once each shape a PDF fills more than once, as a form drawn from each place it was, within
 * 0.01 point of it. What it cannot rewrite safely stays as it is: a page holding an inline image,
 * a page its unit enlarges, a shape under a transform that enlarges, a shape filled with a pattern,
 * a shape in a path another operator interrupts, a shape in a text object, and whatever is not a
 * shape, its text among it.
 */
export function shareShapes(pdf: PDFDocument): void {
  const pages = scannedPagesOf(pdf)
  const forms = formsOf(pages, sharedKeysOf(pages), pdf)
  for (const page of pages) {
    const drawn = page.shapes.filter(({ key }) => forms.has(key))
    if (drawn.length === 0) continue
    for (const { key } of drawn) {
      const form = forms.get(key)
      if (form !== undefined) page.node.setXObject(PDFName.of(form.name), form.reference)
    }
    const stream = pdf.context.flateStream(contentWithForms(page, forms))
    page.node.set(PDFName.of('Contents'), pdf.context.register(stream))
  }
}
