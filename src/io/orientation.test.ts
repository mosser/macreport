import { describe, expect, it } from 'vitest'
import { orientationOf } from './orientation.ts'

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

describe('orientationOf', () => {
  it('turns a photo as its Exif orientation says, in either byte order', () => {
    expect(orientationOf(jpegOf(1))).toBe(0)
    expect(orientationOf(jpegOf(6))).toBe(90)
    expect(orientationOf(jpegOf(3, true))).toBe(180)
    expect(orientationOf(jpegOf(8, true))).toBe(270)
  })

  it('turns a mirrored photo by its turn only', () => {
    expect([2, 4, 5, 7].map((orientation) => orientationOf(jpegOf(orientation)))).toEqual([
      0, 180, 270, 90,
    ])
  })

  it('shows as stored an image without orientation, not a JPEG, or cut short', () => {
    expect(orientationOf(jpegOf())).toBe(0)
    expect(orientationOf(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(0)
    expect(orientationOf(jpegOf(6).slice(0, 30))).toBe(0)
    const scan = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2, ...jpegOf(6).slice(2)])
    expect(orientationOf(scan)).toBe(0)
    const notTiff = jpegOf(6)
    notTiff[15] = 0
    expect(orientationOf(notTiff)).toBe(0)
    const noOrientation = jpegOf(6)
    noOrientation[23] = 0x13
    expect(orientationOf(noOrientation)).toBe(0)
  })
})
