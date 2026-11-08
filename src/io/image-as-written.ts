import { documentSizes } from '../domain/document-sizes.ts'
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

/**
 * An image as the report document holds it. Up to the size configured, it keeps its pixels as
 * added. Above it, it is encoded again, and stays as it was added when that is not smaller, or when
 * it cannot be encoded. A JPEG holds no Exif data, either way.
 */
export async function imageAsWritten(
  content: Uint8Array,
  encoder: ImageEncoder,
): Promise<WrittenImage> {
  const orientation = orientationOf(content)
  const kept = formatOf(content) === 'jpeg' ? withoutExif(content) : content
  const encoded = documentSizes.isImageToReduce(kept.length)
    ? await encodedOrNothing(kept, encoder)
    : undefined
  const chosen = encoded !== undefined && encoded.length < kept.length ? encoded : kept
  return {
    content: chosen,
    format: formatOf(chosen) === 'png' ? 'png' : 'jpeg',
    orientation,
  }
}

async function encodedOrNothing(
  content: Uint8Array,
  encoder: ImageEncoder,
): Promise<Uint8Array | undefined> {
  try {
    return formatOf(content) === 'png'
      ? await smallerOf(content, encoder)
      : await encoder.jpeg(content)
  } catch {
    // The image is written as it was added: larger, but readable, and the Claimant loses nothing.
    return undefined
  }
}

/** A PNG encoded again: as a PNG so that a screenshot's text stays crisp, unless a photo's bytes. */
async function smallerOf(content: Uint8Array, encoder: ImageEncoder): Promise<Uint8Array> {
  const png = await encoder.png(content)
  const jpeg = await encoder.jpeg(content)
  return png.length > jpeg.length * largestPngShare ? jpeg : png
}
