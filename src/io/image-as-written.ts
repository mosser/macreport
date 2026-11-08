import { formatOf } from './format.ts'
import type { ImageEncoder } from './image-encoder.ts'
import { withoutExif } from './jpeg.ts'
import { type Orientation, orientationOf } from './orientation.ts'

/** A PNG stays a PNG unless that is more than this many times the size of the same JPEG. */
const largestPngShare = 2

/** An image as the report document holds it, and how its page shows it upright. */
export interface WrittenImage {
  readonly content: Uint8Array
  readonly format: 'jpeg' | 'png'
  readonly orientation: Orientation
}

/** An image of a format as the report document holds it, from what it holds of its pixels. */
function writtenImage(content: Uint8Array, orientation: Orientation): WrittenImage {
  return { content, format: formatOf(content) === 'png' ? 'png' : 'jpeg', orientation }
}

/** The pixels of an image, as added: a JPEG holds no Exif data. */
function pixelsOf(content: Uint8Array): Uint8Array {
  return formatOf(content) === 'jpeg' ? withoutExif(content) : content
}

/** An image the Claimant did not reduce: its pixels as added, a JPEG without its Exif data. */
export function imageAsAdded(content: Uint8Array): WrittenImage {
  return writtenImage(pixelsOf(content), orientationOf(content))
}

/** An image the Claimant reduced, from what reducing gave, shown as its Exif orientation says. */
export function imageReduced(content: Uint8Array, reduced: Uint8Array): WrittenImage {
  return writtenImage(reduced, orientationOf(content))
}

/**
 * What reducing an image gives: encoded again, handed over without its Exif data. A PNG stays a PNG
 * so that a screenshot's text stays crisp, unless a photo's bytes make that more than twice the size
 * of the same JPEG. Rejects an image it cannot encode.
 */
export async function reducedImage(
  content: Uint8Array,
  encoder: ImageEncoder,
): Promise<Uint8Array> {
  const pixels = pixelsOf(content)
  if (formatOf(pixels) !== 'png') return encoder.jpeg(pixels)
  const png = await encoder.png(pixels)
  const jpeg = await encoder.jpeg(pixels)
  return png.length > jpeg.length * largestPngShare ? jpeg : png
}
