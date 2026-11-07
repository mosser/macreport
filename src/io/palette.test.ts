import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { paletteFrom } from './palette.ts'

const tokens = new Map(
  [...readFileSync('src/style.css', 'utf8').matchAll(/(--mac-[a-z-]+):([^;]*);/g)].map((match) => [
    match[1] ?? '',
    (match[2] ?? '').trim(),
  ]),
)

describe('paletteFrom', () => {
  it('reads the colours of the report document from the tokens of the palette', () => {
    const palette = paletteFrom((token) => ` ${tokens.get(token) ?? ''}`)
    expect(palette.maroon).toEqual({ red: 122 / 255, green: 0, blue: 60 / 255 })
    expect(palette.grey).toEqual({ red: 73 / 255, green: 89 / 255, blue: 101 / 255 })
    expect(palette.white).toEqual({ red: 1, green: 1, blue: 1 })
    expect(palette.black).toEqual({ red: 0, green: 0, blue: 0 })
  })

  it('reads the tokens as the build writes them, shortened where each channel is a pair', () => {
    const shortened = (hex: string) =>
      /^#(.)\1(.)\2(.)\3$/i.test(hex) ? `#${hex[1]}${hex[3]}${hex[5]}` : hex
    const read = (token: string) => tokens.get(token) ?? ''
    expect(shortened(read('--mac-black'))).toHaveLength(4)
    expect(paletteFrom((token) => shortened(read(token)))).toEqual(paletteFrom(read))
  })

  it('refuses a token that is not a colour', () => {
    expect(() => paletteFrom(() => 'maroon')).toThrow(TypeError)
  })
})
