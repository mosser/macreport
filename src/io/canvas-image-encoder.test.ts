import { afterEach, describe, expect, it, vi } from 'vitest'
import { canvasImageEncoder } from './canvas-image-encoder.ts'

interface FakeCanvas {
  width: number
  height: number
  encodedAs?: { type: string; quality: number }
  drawn: { fillStyle?: string; filled: number[][]; images: unknown[][]; smoothing?: string }
  hasNoContext?: boolean
  givesNoBlob?: boolean
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 1])
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1])

/** A page whose canvases only note what is drawn on them. */
function pageWith(canvas: FakeCanvas): globalThis.Document {
  const element = {
    set width(value: number) {
      canvas.width = value
    },
    get width() {
      return canvas.width
    },
    set height(value: number) {
      canvas.height = value
    },
    get height() {
      return canvas.height
    },
    getContext: () =>
      canvas.hasNoContext
        ? null
        : {
            set fillStyle(value: string) {
              canvas.drawn.fillStyle = value
            },
            set imageSmoothingQuality(value: string) {
              canvas.drawn.smoothing = value
            },
            fillRect: (...box: number[]) => canvas.drawn.filled.push(box),
            drawImage: (...image: unknown[]) => canvas.drawn.images.push(image),
          },
    toBlob: (done: (blob: Blob | null) => void, type: string, quality: number) => {
      canvas.encodedAs = { type, quality }
      done(canvas.givesNoBlob ? null : new Blob([new Uint8Array([9, 8, 7])]))
    },
  }
  return { createElement: () => element } as unknown as globalThis.Document
}

const canvasOf = (extra: Partial<FakeCanvas> = {}): FakeCanvas => ({
  width: 0,
  height: 0,
  drawn: { filled: [], images: [] },
  ...extra,
})

/** Gives images of a size, noting what it was given and what it closed. */
function bitmapsOf(width: number, height: number) {
  const bitmap = { width, height, close: vi.fn() }
  const decode = vi.fn(async (_blob: Blob) => bitmap)
  vi.stubGlobal('createImageBitmap', decode)
  return { bitmap, decode }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('canvasImageEncoder', () => {
  it('encodes a JPEG with a long side of 2200 pixels, on the background given', async () => {
    const { bitmap, decode } = bitmapsOf(4032, 3024)
    const canvas = canvasOf()
    const encoder = canvasImageEncoder(pageWith(canvas), 'white')
    expect([...(await encoder.jpeg(jpeg))]).toEqual([9, 8, 7])
    expect(decode.mock.calls[0]?.[0].type).toBe('image/jpeg')
    expect([canvas.width, canvas.height]).toEqual([2200, 1650])
    expect(canvas.encodedAs).toEqual({ type: 'image/jpeg', quality: 0.8 })
    expect(canvas.drawn.fillStyle).toBe('white')
    expect(canvas.drawn.filled).toEqual([[0, 0, 2200, 1650]])
    expect(canvas.drawn.smoothing).toBe('high')
    expect(canvas.drawn.images).toEqual([[bitmap, 0, 0, 2200, 1650]])
    expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it('reduces by the long side, whichever it is', async () => {
    bitmapsOf(1000, 4400)
    const canvas = canvasOf()
    await canvasImageEncoder(pageWith(canvas), 'white').jpeg(jpeg)
    expect([canvas.width, canvas.height]).toEqual([500, 2200])
  })

  it('never enlarges an image', async () => {
    bitmapsOf(800, 600)
    const canvas = canvasOf()
    await canvasImageEncoder(pageWith(canvas), 'white').jpeg(jpeg)
    expect([canvas.width, canvas.height]).toEqual([800, 600])
  })

  it('encodes a PNG keeping its transparency', async () => {
    const { decode } = bitmapsOf(3000, 1000)
    const canvas = canvasOf()
    await canvasImageEncoder(pageWith(canvas), 'white').png(png)
    expect(decode.mock.calls[0]?.[0].type).toBe('image/png')
    expect(canvas.encodedAs?.type).toBe('image/png')
    expect(canvas.drawn.filled).toEqual([])
  })

  it('rejects when the browser gives no canvas, closing the image', async () => {
    const { bitmap } = bitmapsOf(100, 100)
    const encoder = canvasImageEncoder(pageWith(canvasOf({ hasNoContext: true })), 'white')
    await expect(encoder.jpeg(jpeg)).rejects.toThrow(TypeError)
    expect(bitmap.close).toHaveBeenCalledOnce()
  })

  it('rejects when the browser does not encode the image', async () => {
    bitmapsOf(100, 100)
    const encoder = canvasImageEncoder(pageWith(canvasOf({ givesNoBlob: true })), 'white')
    await expect(encoder.jpeg(jpeg)).rejects.toThrow(TypeError)
  })
})
