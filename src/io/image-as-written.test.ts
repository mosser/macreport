import { describe, expect, it } from 'vitest'
import { imageAsAdded, imageReduced, reducedImage } from './image-as-written.ts'
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

describe('imageAsAdded', () => {
  it('keeps the pixels of a JPEG, however large, without its Exif data', () => {
    const content = jpegOf(5 * megabyte)
    const image = imageAsAdded(content)
    expect(image.format).toBe('jpeg')
    expect(image.content).toHaveLength(content.length - exifSegment.length)
    expect([...image.content.subarray(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xda])
  })

  it('keeps a PNG, however large, as it was added', () => {
    const content = pngOf(5 * megabyte)
    expect(imageAsAdded(content)).toEqual({
      content,
      format: 'png',
      orientation: { isMirrored: false, turn: 0 },
    })
  })

  it('shows a JPEG as its Exif orientation says', () => {
    expect(imageAsAdded(jpegOf(1000)).orientation).toEqual({ isMirrored: false, turn: 90 })
  })
})

describe('imageReduced', () => {
  it('shows what reducing gave as the Exif orientation of the file added says', () => {
    const reduced = encodedJpeg(500)
    expect(imageReduced(jpegOf(1000), reduced)).toEqual({
      content: reduced,
      format: 'jpeg',
      orientation: { isMirrored: false, turn: 90 },
    })
  })

  it('takes the format of what reducing gave', () => {
    expect(imageReduced(pngOf(1000), encodedJpeg(500)).format).toBe('jpeg')
    expect(imageReduced(pngOf(1000), pngOf(500)).format).toBe('png')
  })
})

describe('reducedImage', () => {
  it('encodes a JPEG, handing it over without its Exif data', async () => {
    const { encoder, handed } = encoderOf({ jpeg: 500 })
    expect(await reducedImage(jpegOf(2 * megabyte), encoder)).toHaveLength(500)
    expect([...(handed[0]?.subarray(0, 4) ?? [])]).toEqual([0xff, 0xd8, 0xff, 0xda])
  })

  it('keeps a screenshot a PNG, up to twice the size of the same JPEG', async () => {
    const reduced = await reducedImage(
      pngOf(5 * megabyte),
      encoderOf({ png: 200, jpeg: 100 }).encoder,
    )
    expect([...reduced.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(reduced).toHaveLength(200)
  })

  it('makes a photo saved as a PNG a JPEG, beyond twice the size', async () => {
    const reduced = await reducedImage(
      pngOf(25 * megabyte),
      encoderOf({ png: 201, jpeg: 100 }).encoder,
    )
    expect([...reduced.subarray(0, 2)]).toEqual([0xff, 0xd8])
    expect(reduced).toHaveLength(100)
  })

  it('rejects an image it cannot encode', async () => {
    const failing: ImageEncoder = {
      jpeg: async () => {
        throw new TypeError('Cannot read it')
      },
      png: async () => {
        throw new TypeError('Cannot read it')
      },
    }
    await expect(reducedImage(jpegOf(1000), failing)).rejects.toThrow(TypeError)
  })
})
