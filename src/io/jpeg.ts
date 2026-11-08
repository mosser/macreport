/** The markers that end the segments a JPEG opens with: the start of its scan, the end of image. */
const startOfScan = 0xda
const endOfImage = 0xd9
const firstApplicationSegment = 0xe0
const lastApplicationSegment = 0xef
const iccApplicationSegment = 0xe2
const comment = 0xfe
/** The application segments a decoder needs: JFIF's, and Adobe's colour transform. */
const decoderApplicationSegments: ReadonlySet<number> = new Set([0xe0, 0xee])
/** The markers between 0xc0 and 0xcf that do not hold the size of the image. */
const notFrameMarkers: ReadonlySet<number> = new Set([0xc4, 0xc8, 0xcc])
const iccSignature = 'ICC_PROFILE'

/** A segment of the header of a JPEG: its marker, where it starts and where the next one does. */
interface Segment {
  readonly marker: number
  readonly start: number
  readonly end: number
}

/** The segments before a JPEG's scan, as far as they can be read; none when it is not a JPEG. */
function segmentsOf(content: Uint8Array): Segment[] {
  const segments: Segment[] = []
  if (content[0] !== 0xff || content[1] !== 0xd8) return segments
  let offset = 2
  while (offset + 4 <= content.length && content[offset] === 0xff) {
    const marker = content[offset + 1] ?? endOfImage
    if (marker === startOfScan || marker === endOfImage) break
    const length = ((content[offset + 2] ?? 0) << 8) | (content[offset + 3] ?? 0)
    if (offset + 2 + length > content.length) break
    segments.push({ marker, start: offset, end: offset + 2 + length })
    offset += 2 + length
  }
  return segments
}

/** Whether a segment holds a part of the colour profile. */
function isColourProfile(content: Uint8Array, segment: Segment): boolean {
  if (segment.marker !== iccApplicationSegment) return false
  const signature = content.subarray(segment.start + 4, segment.start + 4 + iccSignature.length)
  return String.fromCodePoint(...signature) === iccSignature
}

/** Whether a segment says something of the camera or the file rather than of the image. */
function isLeftOut(content: Uint8Array, segment: Segment): boolean {
  if (segment.marker === comment) return true
  const isApplicationSegment =
    segment.marker >= firstApplicationSegment && segment.marker <= lastApplicationSegment
  return (
    isApplicationSegment &&
    !decoderApplicationSegments.has(segment.marker) &&
    !isColourProfile(content, segment)
  )
}

/**
 * A JPEG holding its image and its colour profile only: the Exif data of a photo, its location
 * among it, is left out. The bytes given when there is nothing to leave out.
 */
export function withoutExif(content: Uint8Array): Uint8Array {
  const leftOut = segmentsOf(content).filter((segment) => isLeftOut(content, segment))
  if (leftOut.length === 0) return content
  const removed = leftOut.reduce((total, segment) => total + segment.end - segment.start, 0)
  const kept = new Uint8Array(content.length - removed)
  let from = 0
  let to = 0
  for (const segment of leftOut) {
    kept.set(content.subarray(from, segment.start), to)
    to += segment.start - from
    from = segment.end
  }
  kept.set(content.subarray(from), to)
  return kept
}

/** The width and height of a JPEG, in pixels, or nothing when its header says neither. */
export function sizeOfJpeg(content: Uint8Array): { width: number; height: number } | undefined {
  const frame = segmentsOf(content).find(
    ({ marker }) => marker >= 0xc0 && marker <= 0xcf && !notFrameMarkers.has(marker),
  )
  if (frame === undefined) return undefined
  const read = (at: number) =>
    ((content[frame.start + at] ?? 0) << 8) | (content[frame.start + at + 1] ?? 0)
  return { height: read(5), width: read(7) }
}
