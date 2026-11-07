import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { paletteFrom } from './palette.ts'

const tokens = new Map(
  [...readFileSync('src/style.css', 'utf8').matchAll(/(--mac-[a-z-]+):\s*([^;]+);/g)].map(
    (match) => [match[1] ?? '', match[2] ?? ''],
  ),
)

describe('paletteFrom', () => {
  it('reads the colours of the report document from the tokens of the palette', () => {
    const palette = paletteFrom((token) => ` ${tokens.get(token) ?? ''}`)
    expect(palette.maroon).toEqual({ red: 122 / 255, green: 0, blue: 60 / 255 })
    expect(palette.grey).toEqual({ red: 73 / 255, green: 89 / 255, blue: 101 / 255 })
    expect(palette.white).toEqual({ red: 1, green: 1, blue: 1 })
    expect(palette.black).toEqual({ red: 0, green: 0, blue: 0 })
  })

  it('refuses a token that is not a colour', () => {
    expect(() => paletteFrom(() => 'maroon')).toThrow(TypeError)
  })
})
