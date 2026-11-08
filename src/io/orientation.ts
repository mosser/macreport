import type { Rotation } from './page-view.ts'

/** The Exif tag that says how a photo is turned. */
const orientationTag = 0x0112

/** How an image shows upright: mirrored left to right first when it is, then turned clockwise. */
export interface Orientation {
  readonly isMirrored: boolean
  readonly turn: Rotation
}

const asStored: Orientation = { isMirrored: false, turn: 0 }

/** Each Exif orientation but the first, as a mirror and a turn. */
const orientations: Readonly<Record<number, Orientation>> = {
  2: { isMirrored: true, turn: 0 },
  3: { isMirrored: false, turn: 180 },
  4: { isMirrored: true, turn: 180 },
  5: { isMirrored: true, turn: 270 },
  6: { isMirrored: false, turn: 90 },
  7: { isMirrored: true, turn: 90 },
  8: { isMirrored: false, turn: 270 },
}

/**
 * How a JPEG image shows upright, as the Exif orientation a phone writes says: 6 is a quarter
 * turn, 3 a half, 8 three quarters, and 2, 4, 5 and 7 the same mirrored. An image without one, or
 * that is not a JPEG, shows as it is stored.
 */
export function orientationOf(content: Uint8Array): Orientation {
  try {
    const data = new DataView(content.buffer, content.byteOffset, content.byteLength)
    return orientations[exifOrientationOf(data) ?? 1] ?? asStored
  } catch {
    // A header cut short: the image shows as it is stored.
    return asStored
  }
}

/**
 * A JPEG encoded from another, saying the orientation of the other, for a viewer to show it upright:
 * an Exif segment holding that one value, and nothing else of the original. The bytes given when
 * there is no orientation to say, or for an image that is not a JPEG.
 */
export function withOrientationOf(original: Uint8Array, jpeg: Uint8Array): Uint8Array {
  const orientation = exifOrientationIn(original)
  if (orientation === undefined || orientation === 1 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    return jpeg
  }
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0]
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8]
  const directory = [0, 1, orientationTag >> 8, orientationTag & 0xff, 0, 3, 0, 0, 0, 1]
  const value = [0, orientation, 0, 0, 0, 0, 0, 0]
  const body = [...exif, ...tiff, ...directory, ...value]
  const segment = [0xff, 0xe1, 0, body.length + 2, ...body]
  const shown = new Uint8Array(jpeg.length + segment.length)
  shown.set(jpeg.subarray(0, 2))
  shown.set(segment, 2)
  shown.set(jpeg.subarray(2), 2 + segment.length)
  return shown
}

/** The Exif orientation of a JPEG, or nothing when it has none or its header is cut short. */
function exifOrientationIn(content: Uint8Array): number | undefined {
  try {
    return exifOrientationOf(new DataView(content.buffer, content.byteOffset, content.byteLength))
  } catch {
    return undefined
  }
}

/** The Exif orientation of a JPEG, from the APP1 segment before its image data. */
function exifOrientationOf(data: DataView): number | undefined {
  if (data.getUint16(0) !== 0xffd8) return undefined
  let offset = 2
  while (offset + 4 <= data.byteLength && data.getUint8(offset) === 0xff) {
    const marker = data.getUint8(offset + 1)
    if (marker === 0xda || marker === 0xd9) return undefined
    const length = data.getUint16(offset + 2)
    if (marker === 0xe1 && isExif(data, offset + 4)) {
      return tiffOrientationOf(data, offset + 10)
    }
    offset += 2 + length
  }
  return undefined
}

/** Whether the bytes at an offset open an Exif segment: "Exif" and two zeros. */
function isExif(data: DataView, offset: number): boolean {
  return data.getUint32(offset) === 0x45786966 && data.getUint16(offset + 4) === 0
}

/** The orientation in the first directory of the TIFF structure an Exif segment holds. */
function tiffOrientationOf(data: DataView, tiff: number): number | undefined {
  const isLittleEndian = data.getUint16(tiff) === 0x4949
  const read16 = (at: number) => data.getUint16(at, isLittleEndian)
  if (read16(tiff + 2) !== 42) return undefined
  const directory = tiff + data.getUint32(tiff + 4, isLittleEndian)
  const entries = read16(directory)
  for (let index = 0; index < entries; index += 1) {
    const entry = directory + 2 + index * 12
    if (read16(entry) === orientationTag) {
      return read16(entry + 8)
    }
  }
  return undefined
}
