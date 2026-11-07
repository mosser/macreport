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

const hexColour = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

function colourOf(token: string, value: string): Colour {
  const match = hexColour.exec(value.trim())
  if (match === null) {
    throw new TypeError(`The palette token ${token} is not a colour: '${value}'`)
  }
  const channel = (hex: string | undefined) => Number.parseInt(hex ?? '0', 16) / 255
  return { red: channel(match[1]), green: channel(match[2]), blue: channel(match[3]) }
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
    rule: read('--mac-accent-light-grey'),
  }
}
