/**
 * The characters Noto Sans holds, Regular and Bold alike, as the first and the last of each run of
 * consecutive code points. A test reads the fonts and compares them with these runs, so that this
 * finding and the writer of the report document cannot disagree (ADR 0006).
 */
export const fontCharacters: readonly (readonly [number, number])[] = [
  [0x20, 0x7e],
  [0xa0, 0x377],
  [0x37a, 0x37f],
  [0x384, 0x38a],
  [0x38c, 0x38c],
  [0x38e, 0x3a1],
  [0x3a3, 0x3e1],
  [0x3f0, 0x52f],
  [0x1e00, 0x1f15],
  [0x1f18, 0x1f1d],
  [0x1f20, 0x1f45],
  [0x1f48, 0x1f4d],
  [0x1f50, 0x1f57],
  [0x1f59, 0x1f59],
  [0x1f5b, 0x1f5b],
  [0x1f5d, 0x1f5d],
  [0x1f5f, 0x1f7d],
  [0x1f80, 0x1fb4],
  [0x1fb6, 0x1fc4],
  [0x1fc6, 0x1fd3],
  [0x1fd6, 0x1fdb],
  [0x1fdd, 0x1fef],
  [0x1ff2, 0x1ff4],
  [0x1ff6, 0x1ffe],
  [0x2000, 0x2064],
  [0x2066, 0x206f],
  [0x20a0, 0x20c0],
  [0x2100, 0x214f],
  [0x2212, 0x2212],
  [0x2c60, 0x2c7f],
  [0x2de0, 0x2dff],
  [0xa640, 0xa69f],
  [0xa720, 0xa7ca],
  [0xa7d0, 0xa7d1],
  [0xa7d3, 0xa7d3],
  [0xa7d5, 0xa7d9],
  [0xa7f2, 0xa7ff],
  [0xfffd, 0xfffd],
  [0xffff, 0xffff],
]

/** A line break or a tab, which the report document writes as the end of a line or as a space. */
const writtenAsSpace = new Set(['\n', '\r', '\t'])

function isWritable(character: string): boolean {
  if (writtenAsSpace.has(character)) return true
  const point = character.codePointAt(0) ?? 0
  return fontCharacters.some(([first, last]) => first <= point && point <= last)
}

/**
 * The characters of a text the report document cannot write, each once, in the order they come.
 * A text is judged in its composed form, so that an accent typed as a separate mark counts as the
 * accented letter.
 */
export function charactersNotWritableIn(text: string): readonly string[] {
  return [...new Set(text.normalize('NFC'))].filter((character) => !isWritable(character))
}
