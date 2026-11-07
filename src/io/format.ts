/** What a document's bytes are: a PDF, a JPEG image or a PNG image. */
export type Format = 'pdf' | 'jpeg' | 'png'

/** Whether the bytes are a PDF, a JPEG image or a PNG image, from their first bytes. */
export function formatOf(content: Uint8Array): Format {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => content[index] === byte)
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'png'
  if (starts(0xff, 0xd8, 0xff)) return 'jpeg'
  return 'pdf'
}

/** The media type a browser shows bytes of a format as. */
export const mediaTypes: Readonly<Record<Format, string>> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
}
