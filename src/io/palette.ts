/** A colour of the McMaster palette, as red, green and blue between 0 and 1. */
export interface Colour {
  readonly red: number
  readonly green: number
  readonly blue: number
}

/** The colours of the report document, taken from the tokens of the palette (ADR 0002). */
export interface Palette {
  readonly maroon: Colour
  readonly grey: Colour
  readonly black: Colour
  readonly white: Colour
  readonly rule: Colour
}

/** A hexadecimal colour, in its long form or in the short form a minifier writes. */
const hexColour = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

function colourOf(token: string, value: string): Colour {
  const digits = hexColour.exec(value.trim())?.[1]
  if (digits === undefined) {
    throw new TypeError(`The palette token ${token} is not a colour: '${value}'`)
  }
  const long = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits
  const channel = (start: number) => Number.parseInt(long.slice(start, start + 2), 16) / 255
  return { red: channel(0), green: channel(2), blue: channel(4) }
}

/**
 * The palette of the report document, from a function that reads a token of the palette, such as
 * the computed style of the page. Throws a TypeError when a token is not a colour.
 */
export function paletteFrom(readToken: (token: string) => string): Palette {
  const read = (token: string) => colourOf(token, readToken(token))
  return {
    maroon: read('--mac-maroon'),
    grey: read('--mac-grey'),
    black: read('--mac-black'),
    white: read('--mac-white'),
    rule: read('--mac-grey'),
  }
}
