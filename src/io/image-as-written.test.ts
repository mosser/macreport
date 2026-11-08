import { describe, expect, it } from 'vitest'
import { imageAsWritten } from './image-as-written.ts'
import type { ImageEncoder } from './image-encoder.ts'

const megabyte = 1_000_000
const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3]
const orientationSix = [0, 0, 0, 1, 0, 6, 0, 0, 0, 0, 0, 0]
const exifSegment = [
  0xff,
  0xe1,
  0,
  exif.length + orientationSix.length + 2,
  ...exif,
  ...orientationSix,
]

/** A JPEG of about a size: an Exif segment saying to turn it a quarter, then padding as its scan. */
function jpegOf(size: number): Uint8Array {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, ...exifSegment, 0xff, 0xda, 0, 2])
  return bytes
}

function pngOf(size: number): Uint8Array {
  const bytes = new Uint8Array(size)
  bytes.set([0x89, 0x50, 0x4e, 0x47])
  return bytes
}

const encodedJpeg = (size: number) => {
  const bytes = new Uint8Array(size)
  bytes.set([0xff, 0xd8, 0xff, 0xda])
  return bytes
}

/** An encoder giving bytes of the sizes asked, noting what it is handed. */
function encoderOf(sizes: { jpeg?: number; png?: number }) {
  const handed: Uint8Array[] = []
  const encoder: ImageEncoder = {
    jpeg: async (content) => {
      handed.push(content)
      return encodedJpeg(sizes.jpeg ?? 1)
    },
    png: async (content) => {
      handed.push(content)
      return pngOf(sizes.png ?? 1)
    },
  }
  return { encoder, handed }
}

const failing: ImageEncoder = {
  jpeg: async () => {
    throw new TypeError('Cannot read it')
  },
  png: async () => {
    throw new TypeError('Cannot read it')
  },
}

describe('imageAsWritten', () => {
  it('keeps the pixels of a JPEG up to the size configured, without its Exif data', async () => {
    const content = jpegOf(megabyte)
    const { encoder, handed } = encoderOf({ jpeg: 10 })
    const image = await imageAsWritten(content, encoder)
    expect(handed).toEqual([])
    expect(image.format).toBe('jpeg')
    expect(image.content).toHaveLength(content.length - exifSegment.length)
    expect([...image.content.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xda])
  })

  it('encodes a JPEG above the size configured, handing it over without its Exif data', async () => {
    const { encoder, handed } = encoderOf({ jpeg: 500 })
    const image = await imageAsWritten(jpegOf(2 * megabyte), encoder)
    expect(image.content).toHaveLength(500)
    expect(image.format).toBe('jpeg')
    expect([...(handed[0]?.subarray(0, 4) ?? [])]).toEqual([0xff, 0xd8, 0xff, 0xda])
  })

  it('still shows a JPEG as its Exif orientation says, once encoded or not', async () => {
    const small = await imageAsWritten(jpegOf(1000), encoderOf({}).encoder)
    expect(small.orientation).toEqual({ isMirrored: false, turn: 90 })
    const large = await imageAsWritten(jpegOf(2 * megabyte), encoderOf({ jpeg: 500 }).encoder)
    expect(large.orientation).toEqual({ isMirrored: false, turn: 90 })
  })

  it('keeps the pixels of a JPEG that encoding does not make smaller', async () => {
    const content = jpegOf(2 * megabyte)
    const image = await imageAsWritten(content, encoderOf({ jpeg: 3 * megabyte }).encoder)
    expect(image.content).toHaveLength(content.length - exifSegment.length)
  })

  it('writes an image it cannot encode as it was added', async () => {
    const jpeg = await imageAsWritten(jpegOf(2 * megabyte), failing)
    expect(jpeg.content).toHaveLength(2 * megabyte - exifSegment.length)
    const png = pngOf(2 * megabyte)
    expect((await imageAsWritten(png, failing)).content).toBe(png)
  })

  it('leaves a PNG up to the size configured as it was added', async () => {
    const content = pngOf(megabyte)
    const { encoder, handed } = encoderOf({ png: 10, jpeg: 10 })
    const image = await imageAsWritten(content, encoder)
    expect(image).toEqual({ content, format: 'png', orientation: { isMirrored: false, turn: 0 } })
    expect(handed).toEqual([])
  })

  it('keeps a screenshot a PNG, up to twice the size of the same JPEG', async () => {
    const image = await imageAsWritten(
      pngOf(5 * megabyte),
      encoderOf({ png: 200, jpeg: 100 }).encoder,
    )
    expect(image.format).toBe('png')
    expect(image.content).toHaveLength(200)
  })

  it('makes a photo saved as a PNG a JPEG, beyond twice the size', async () => {
    const image = await imageAsWritten(
      pngOf(25 * megabyte),
      encoderOf({ png: 201, jpeg: 100 }).encoder,
    )
    expect(image.format).toBe('jpeg')
    expect(image.content).toHaveLength(100)
  })

  it('leaves a PNG as it was added when neither encoding is smaller', async () => {
    const content = pngOf(2 * megabyte)
    const image = await imageAsWritten(
      content,
      encoderOf({ png: 3 * megabyte, jpeg: 2 * megabyte }).encoder,
    )
    expect(image.content).toBe(content)
    expect(image.format).toBe('png')
  })
})
