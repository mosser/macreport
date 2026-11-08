import { readFileSync } from 'node:fs'
import fontkit from '@cantoo/fontkit'
import { describe, expect, it } from 'vitest'
import { fontCharacters } from '../domain/writable-characters.ts'

/** The code points a font holds, sorted. */
function pointsOf(weight: string): number[] {
  const font = fontkit.create(readFileSync(`src/assets/fonts/NotoSans-${weight}.ttf`))
  if (!('characterSet' in font)) throw new TypeError(`${weight} is a collection of fonts`)
  return [...font.characterSet].sort((one, other) => one - other)
}

describe('the characters the domain holds as writable', () => {
  const held = fontCharacters.flatMap(([first, last]) =>
    Array.from({ length: last - first + 1 }, (_, index) => first + index),
  )

  it.each(['Regular', 'Bold'])('are those of Noto Sans %s', (weight) => {
    expect(held).toEqual(pointsOf(weight))
  })
})
