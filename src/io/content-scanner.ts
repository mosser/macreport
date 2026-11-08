/** A token of a page's content stream, with where it sits in the bytes of that stream. */
export type Token =
  | {
      readonly kind: 'number'
      readonly value: number
      readonly start: number
      readonly end: number
    }
  | { readonly kind: 'name'; readonly start: number; readonly end: number }
  | {
      readonly kind: 'operator'
      readonly text: string
      readonly start: number
      readonly end: number
    }
  | { readonly kind: 'other'; readonly start: number; readonly end: number }

const openParenthesis = 0x28
const closeParenthesis = 0x29
const backslash = 0x5c
const lessThan = 0x3c
const greaterThan = 0x3e
const slash = 0x2f
const percent = 0x25
const whitespace: ReadonlySet<number> = new Set([0, 9, 10, 12, 13, 32])
/** The characters that end a name, a number or an operator without a space. */
const delimiters: ReadonlySet<number> = new Set([
  openParenthesis,
  closeParenthesis,
  lessThan,
  greaterThan,
  0x5b,
  0x5d,
  0x7b,
  0x7d,
  slash,
  percent,
])
const numberLike = /^[+-]?(\d+\.?\d*|\.\d+)$/

/** Reads the tokens of a content stream, byte by byte, so that its strings stay what they were. */
export class ContentScanner {
  private readonly bytes: Uint8Array
  private position = 0

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  /** The next token, or nothing at the end of the stream. */
  next(): Token | undefined {
    this.skipBlanks()
    const start = this.position
    const byte = this.bytes[start]
    if (byte === undefined) return undefined
    if (byte === openParenthesis) return this.string(start)
    if (byte === lessThan) return this.angled(start)
    if (byte === slash) {
      this.position += 1
      this.skipRegular()
      return { kind: 'name', start, end: this.position }
    }
    if (delimiters.has(byte)) {
      this.position += byte === greaterThan && this.bytes[start + 1] === greaterThan ? 2 : 1
      return { kind: 'other', start, end: this.position }
    }
    this.skipRegular()
    return this.numberOrOperator(start)
  }

  private skipBlanks(): void {
    for (;;) {
      const byte = this.bytes[this.position]
      if (byte === percent) {
        this.skipComment()
      } else if (byte !== undefined && whitespace.has(byte)) {
        this.position += 1
      } else {
        return
      }
    }
  }

  private skipComment(): void {
    for (;;) {
      const byte = this.bytes[this.position]
      if (byte === undefined || byte === 10 || byte === 13) return
      this.position += 1
    }
  }

  private skipRegular(): void {
    for (;;) {
      const byte = this.bytes[this.position]
      if (byte === undefined || whitespace.has(byte) || delimiters.has(byte)) return
      this.position += 1
    }
  }

  /** A literal string, whose parentheses nest and whose backslash escapes the next byte. */
  private string(start: number): Token {
    let depth = 0
    for (;;) {
      const byte = this.bytes[this.position]
      if (byte === undefined) break
      this.position += byte === backslash ? 2 : 1
      if (byte === openParenthesis) depth += 1
      if (byte === closeParenthesis) depth -= 1
      if (depth === 0) break
    }
    return { kind: 'other', start, end: this.position }
  }

  /** The start of a dictionary, or a hexadecimal string. */
  private angled(start: number): Token {
    this.position += 1
    if (this.bytes[this.position] === lessThan) {
      this.position += 1
      return { kind: 'other', start, end: this.position }
    }
    for (;;) {
      const byte = this.bytes[this.position]
      if (byte === undefined) break
      this.position += 1
      if (byte === greaterThan) break
    }
    return { kind: 'other', start, end: this.position }
  }

  private numberOrOperator(start: number): Token {
    const end = this.position
    const text = String.fromCharCode(...this.bytes.subarray(start, end))
    return numberLike.test(text)
      ? { kind: 'number', value: Number(text), start, end }
      : { kind: 'operator', text, start, end }
  }
}
