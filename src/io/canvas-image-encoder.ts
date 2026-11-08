import { formatOf, mediaTypes } from './format.ts'
import { type ImageEncoder, jpegQuality, longestSide } from './image-encoder.ts'

/** The image encoder of the browser, with its canvas; the only code to use one (ADR 0011). */
export function canvasImageEncoder(page: globalThis.Document, background: string): ImageEncoder {
  return {
    jpeg: (content) => encoded(page, content, { type: mediaTypes.jpeg, background }),
    png: (content) => encoded(page, content, { type: mediaTypes.png }),
  }
}

/** What an image is encoded as, and the colour under it when transparency is not kept. */
interface Encoding {
  readonly type: string
  readonly background?: string
}

async function encoded(
  page: globalThis.Document,
  content: Uint8Array,
  encoding: Encoding,
): Promise<Uint8Array> {
  const type = mediaTypes[formatOf(content)]
  const bitmap = await createImageBitmap(new Blob([content as Uint8Array<ArrayBuffer>], { type }))
  try {
    const canvas = canvasFor(page, bitmap, encoding)
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, encoding.type, jpegQuality)
    })
    if (blob === null) {
      throw new TypeError('The browser did not encode the image')
    }
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    bitmap.close()
  }
}

function canvasFor(
  page: globalThis.Document,
  bitmap: ImageBitmap,
  encoding: Encoding,
): HTMLCanvasElement {
  const scale = Math.min(1, longestSide / Math.max(bitmap.width, bitmap.height))
  const canvas = page.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const drawing = canvas.getContext('2d')
  if (drawing === null) {
    throw new TypeError('The browser gives no canvas to encode the image on')
  }
  if (encoding.background !== undefined) {
    drawing.fillStyle = encoding.background
    drawing.fillRect(0, 0, canvas.width, canvas.height)
  }
  drawing.imageSmoothingQuality = 'high'
  drawing.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}
