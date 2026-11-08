import { type PDFFont, rgb } from '@cantoo/pdf-lib'
import type { Colour } from './palette.ts'

/** The size of a page of the report document: US Letter, portrait. */
export const letterPortrait: [number, number] = [612, 792]

/** Three-quarter-inch margins. */
export const margin = 54

/** The colour of a drawing, from a colour of the palette. */
export function colourOf(colour: Colour) {
  return rgb(colour.red, colour.green, colour.blue)
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
