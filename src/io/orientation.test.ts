import { describe, expect, it } from 'vitest'
import { orientationOf, withOrientationOf } from './orientation.ts'

/** A JPEG header, its Exif orientation in the byte order given, then its frame and its end. */
function jpegOf(orientation?: number, isLittleEndian = false): Uint8Array {
  const bytes = [0xff, 0xd8]
  if (orientation !== undefined) {
    const tiff = new DataView(new ArrayBuffer(26))
    tiff.setUint16(0, isLittleEndian ? 0x4949 : 0x4d4d)
    tiff.setUint16(2, 42, isLittleEndian)
    tiff.setUint32(4, 8, isLittleEndian)
    tiff.setUint16(8, 1, isLittleEndian)
    tiff.setUint16(10, 0x0112, isLittleEndian)
    tiff.setUint16(12, 3, isLittleEndian)
    tiff.setUint32(14, 1, isLittleEndian)
    tiff.setUint16(18, orientation, isLittleEndian)
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...new Uint8Array(tiff.buffer)]
    bytes.push(0xff, 0xe1, 0, exif.length + 2, ...exif)
  }
  bytes.push(0xff, 0xc0, 0, 11, 8, 1, 44, 1, 144, 1, 1, 0x11, 0, 0xff, 0xd9)
  return new Uint8Array(bytes)
}

describe('withOrientationOf', () => {
  /** A JPEG of an Exif orientation, or without one. */
  function photoOf(orientation?: number): Uint8Array {
    const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1]
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff, 0, orientation ?? 1, 0, 0, 0, 0, 0, 0]
    const segment = orientation === undefined ? [] : [0xff, 0xe1, 0, exif.length + 2, ...exif]
    return new Uint8Array([0xff, 0xd8, ...segment, 0xff, 0xda, 0, 2, 1, 2, 3])
  }
  const encoded = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xda, 0, 2, 9, 9])

  it.each([2, 3, 4, 5, 6, 7, 8])('says orientation %i of the original', (orientation) => {
    const shown = withOrientationOf(photoOf(orientation), encoded)
    expect(orientationOf(shown)).toEqual(orientationOf(photoOf(orientation)))
    expect([...shown.subarray(-encoded.length + 2)]).toEqual([...encoded.subarray(2)])
    expect([...shown.subarray(0, 2)]).toEqual([0xff, 0xd8])
  })

  it('gives the bytes given when there is no orientation to say', () => {
    expect(withOrientationOf(photoOf(), encoded)).toBe(encoded)
    expect(withOrientationOf(photoOf(1), encoded)).toBe(encoded)
    expect(withOrientationOf(new Uint8Array([0xff, 0xd8, 0xff]), encoded)).toBe(encoded)
  })

  it('gives the bytes given for what is not a JPEG', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    expect(withOrientationOf(photoOf(6), png)).toBe(png)
  })

  it('keeps nothing of the original but its orientation', () => {
    const shown = withOrientationOf(photoOf(6), encoded)
    expect(shown).toHaveLength(encoded.length + 36)
  })
})

describe('orientationOf', () => {
  const turn = (content: Uint8Array) => orientationOf(content).turn
  const isMirrored = (content: Uint8Array) => orientationOf(content).isMirrored

  it('turns a photo as its Exif orientation says, in either byte order', () => {
    expect(orientationOf(jpegOf(1))).toEqual({ isMirrored: false, turn: 0 })
    expect(orientationOf(jpegOf(6))).toEqual({ isMirrored: false, turn: 90 })
    expect(orientationOf(jpegOf(3, true))).toEqual({ isMirrored: false, turn: 180 })
    expect(orientationOf(jpegOf(8, true))).toEqual({ isMirrored: false, turn: 270 })
  })

  it('mirrors a mirrored photo, then turns it', () => {
    const mirrored = [2, 4, 5, 7].map((orientation) => orientationOf(jpegOf(orientation)))
    expect(mirrored).toEqual([
      { isMirrored: true, turn: 0 },
      { isMirrored: true, turn: 180 },
      { isMirrored: true, turn: 270 },
      { isMirrored: true, turn: 90 },
    ])
    expect(orientationOf(jpegOf(9))).toEqual({ isMirrored: false, turn: 0 })
  })

  it('shows as stored an image without orientation, not a JPEG, or cut short', () => {
    expect(turn(jpegOf())).toBe(0)
    expect(turn(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(0)
    expect(turn(jpegOf(6).slice(0, 30))).toBe(0)
    const scan = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2, ...jpegOf(6).slice(2)])
    expect(turn(scan)).toBe(0)
    const notTiff = jpegOf(6)
    notTiff[15] = 0
    expect(turn(notTiff)).toBe(0)
    const noOrientation = jpegOf(6)
    noOrientation[23] = 0x13
    expect(turn(noOrientation)).toBe(0)
    expect(isMirrored(jpegOf(2).slice(0, 30))).toBe(false)
  })
})
