/** What a document's bytes are: a PDF, a JPEG image or a PNG image. */
export type Format = 'pdf' | 'jpeg' | 'png'

/** Whether the bytes are a PDF, a JPEG image or a PNG image, from their first bytes. */
export function formatOf(content: Uint8Array): Format {
  const starts = (...bytes: number[]) => bytes.every((byte, index) => content[index] === byte)
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'png'
  if (starts(0xff, 0xd8, 0xff)) return 'jpeg'
  return 'pdf'
}

/** How far into a file a PDF reader looks for the start of a PDF. */
const pdfHeaderRoom = 1024

/** Whether the bytes hold the start of a PDF, where a PDF reader looks for it. */
function holdsPdfHeader(content: Uint8Array): boolean {
  const start = new TextDecoder('latin1').decode(content.subarray(0, pdfHeaderRoom))
  return start.includes('%PDF-')
}

/**
 * What a file's bytes are, whatever its name says: a PDF, a JPEG image or a PNG image; nothing when
 * they are of another format.
 */
export function recognizedFormatOf(content: Uint8Array): Format | undefined {
  const format = formatOf(content)
  return format !== 'pdf' || holdsPdfHeader(content) ? format : undefined
}

/** The media type a browser shows bytes of a format as. */
export const mediaTypes: Readonly<Record<Format, string>> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
}
