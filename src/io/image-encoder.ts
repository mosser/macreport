/** The long side of an image once reduced, in pixels: below it, digits start to be mistaken. */
export const longestSide = 2200
/** The quality a JPEG is encoded at, between 0 and 1. */
export const jpegQuality = 0.8

/**
 * Encodes an image again with a long side of at most `longestSide`, never enlarged. It is handed
 * an image without Exif data, and gives one as it was stored, not turned. It rejects an image it
 * cannot read.
 */
export interface ImageEncoder {
  /** The image as a JPEG at `jpegQuality`, a transparent background becoming white. */
  jpeg(content: Uint8Array): Promise<Uint8Array>
  /** The image as a PNG. */
  png(content: Uint8Array): Promise<Uint8Array>
}
