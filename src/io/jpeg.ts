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

/** Where the marker at an offset starts: any number of fill bytes 0xff may come before it. */
function afterFillBytes(content: Uint8Array, offset: number): number {
  let start = offset
  while (content[start + 1] === 0xff) start += 1
  return start
}

/** The segments before a JPEG's scan, as far as they can be read; none when it is not a JPEG. */
function segmentsOf(content: Uint8Array): Segment[] {
  const segments: Segment[] = []
  if (content[0] !== 0xff || content[1] !== 0xd8) return segments
  let offset = 2
  while (content[offset] === 0xff) {
    const start = afterFillBytes(content, offset)
    if (start + 4 > content.length) break
    const marker = content[start + 1] ?? endOfImage
    if (marker === startOfScan || marker === endOfImage) break
    const length = ((content[start + 2] ?? 0) << 8) | (content[start + 3] ?? 0)
    if (start + 2 + length > content.length) break
    segments.push({ marker, start, end: start + 2 + length })
    offset = start + 2 + length
  }
  return segments
}

/**
 * Whether a JPEG holds its image to its end: its scan starts, and the end of its image comes after
 * that. A file cut short has none, though its header can be read. An end before its scan, as of a
 * thumbnail, is not the end of its image; bytes may follow the end, as some cameras write.
 */
export function isWholeJpeg(content: Uint8Array): boolean {
  const scan = afterFillBytes(content, segmentsOf(content).at(-1)?.end ?? 2)
  if (content[scan] !== 0xff || content[scan + 1] !== startOfScan) return false
  for (let index = content.length - 2; index > scan + 1; index -= 1) {
    if (content[index] === 0xff && content[index + 1] === endOfImage) return true
  }
  return false
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
  return withoutSegments(content, isLeftOut)
}

/**
 * A JPEG without its colour profile, for an image of a PDF, whose colour space says how to read its
 * samples: a decoder given the profile would convert them. The bytes given when it holds none.
 */
export function withoutColourProfile(content: Uint8Array): Uint8Array {
  return withoutSegments(content, isColourProfile)
}

/** A JPEG without the segments of its header a rule takes out. */
function withoutSegments(
  content: Uint8Array,
  isTakenOut: (content: Uint8Array, segment: Segment) => boolean,
): Uint8Array {
  const leftOut = segmentsOf(content).filter((segment) => isTakenOut(content, segment))
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
