import type { Rotation } from './page-view.ts'

/** The Exif tag that says how a photo is turned. */
const orientationTag = 0x0112

/**
 * The quarter turn, clockwise, that shows a JPEG image upright, as the Exif orientation a phone
 * writes says: 6 is a quarter, 3 a half, 8 three quarters. A mirrored orientation is shown with
 * its turn only. An image without one, or that is not a JPEG, shows as it is stored.
 */
export function orientationOf(content: Uint8Array): Rotation {
  try {
    const data = new DataView(content.buffer, content.byteOffset, content.byteLength)
    return turnOf(exifOrientationOf(data))
  } catch {
    // A header cut short: the image shows as it is stored.
    return 0
  }
}

function turnOf(orientation: number | undefined): Rotation {
  switch (orientation) {
    case 3:
    case 4:
      return 180
    case 5:
    case 8:
      return 270
    case 6:
    case 7:
      return 90
    default:
      return 0
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
