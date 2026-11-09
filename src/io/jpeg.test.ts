import { describe, expect, it } from 'vitest'
import { isWholeJpeg, sizeOfJpeg, withoutColourProfile, withoutExif } from './jpeg.ts'

const segment = (marker: number, ...data: number[]) => [
  0xff,
  marker,
  (data.length + 2) >> 8,
  (data.length + 2) & 0xff,
  ...data,
]
const ascii = (text: string) => [...text].map((character) => character.charCodeAt(0))
const jfif = segment(0xe0, ...ascii('JFIF'), 0)
const exif = segment(0xe1, ...ascii('Exif'), 0, 0, 1, 2, 3)
const xmp = segment(0xe1, ...ascii('http://ns.adobe.com/xap'), 0)
const profile = segment(0xe2, ...ascii('ICC_PROFILE'), 0, 1, 1, 9)
const multiPicture = segment(0xe2, ...ascii('MPF'), 0, 9)
const photoshop = segment(0xed, ...ascii('Photoshop'), 0)
const adobe = segment(0xee, ...ascii('Adobe'), 0, 1)
const note = segment(0xfe, ...ascii('Taken at home'))
const frame = segment(0xc0, 8, 0x08, 0x98, 0x05, 0x78, 3, 1, 0x11, 0)
const table = segment(0xc4, 0, 1, 2)
const scan = [0xff, 0xda, 0, 2, 0xff, 0xe1, 0, 4, 7, 7, 0xff, 0xd9]
const jpegOf = (...segments: number[][]) =>
  new Uint8Array([0xff, 0xd8, ...segments.flat(), ...scan])

describe('withoutExif', () => {
  it('leaves out what speaks of the camera or the file, and keeps the rest in its order', () => {
    const content = jpegOf(jfif, exif, xmp, multiPicture, profile, photoshop, adobe, note, frame)
    expect([...withoutExif(content)]).toEqual([...jpegOf(jfif, profile, adobe, frame)])
  })

  it('leaves out a segment whose marker fill bytes pad', () => {
    const content = jpegOf(frame, [0xff, 0xff, ...exif], jfif)
    expect([...withoutExif(content)]).toEqual([...jpegOf(frame, [0xff, 0xff], jfif)])
  })

  it('touches nothing after the start of the scan, whatever it looks like', () => {
    const kept = withoutExif(jpegOf(exif, frame))
    expect([...kept.subarray(-scan.length)]).toEqual(scan)
  })

  it('gives the same bytes when there is nothing to leave out', () => {
    const content = jpegOf(jfif, profile, frame)
    expect(withoutExif(content)).toBe(content)
  })

  it('gives the same bytes when they are not a JPEG, or are cut short', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    expect(withoutExif(png)).toBe(png)
    const cut = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1])
    expect(withoutExif(cut)).toBe(cut)
  })
})

describe('withoutColourProfile', () => {
  it('leaves out the colour profile, and only it', () => {
    const content = jpegOf(jfif, profile, multiPicture, adobe, frame)
    expect([...withoutColourProfile(content)]).toEqual([
      ...jpegOf(jfif, multiPicture, adobe, frame),
    ])
  })

  it('gives the same bytes when it holds none', () => {
    const content = jpegOf(jfif, adobe, frame)
    expect(withoutColourProfile(content)).toBe(content)
  })
})

describe('sizeOfJpeg', () => {
  it('reads the size of a JPEG from its frame, past the tables before it', () => {
    expect(sizeOfJpeg(jpegOf(jfif, table, frame))).toEqual({ width: 1400, height: 2200 })
  })

  it('reads the size of a JPEG past fill bytes before its frame', () => {
    expect(sizeOfJpeg(jpegOf(jfif, [0xff, 0xff], frame))).toEqual({ width: 1400, height: 2200 })
  })

  it('says nothing of bytes without a frame', () => {
    expect(sizeOfJpeg(jpegOf(jfif))).toBeUndefined()
    expect(sizeOfJpeg(new Uint8Array([1, 2, 3]))).toBeUndefined()
  })
})

describe('isWholeJpeg', () => {
  const start = [0xff, 0xd8]
  const scan = [0xff, 0xda, 0, 3, 1, 9, 9]
  const end = [0xff, 0xd9]
  const whole = (...bytes: number[]) => isWholeJpeg(new Uint8Array(bytes))

  it('is true of a JPEG whose scan starts and whose image ends', () => {
    expect(whole(...start, ...frame, ...scan, ...end)).toBe(true)
    expect(whole(...start, ...exif, ...frame, ...scan, ...end, 7, 7)).toBe(true)
    expect(whole(...start, ...scan, ...end)).toBe(true)
  })

  it('is false of a JPEG cut short, whatever came before', () => {
    expect(whole(...start, ...frame)).toBe(false)
    expect(whole(...start, ...frame, ...scan)).toBe(false)
    expect(whole(...start, ...frame, ...end)).toBe(false)
    expect(whole(...start)).toBe(false)
  })

  it('does not take the end of a thumbnail before its scan for the end of its image', () => {
    const thumbnail = segment(0xe1, ...ascii('Exif'), 0, 0xff, 0xd9)
    expect(whole(...start, ...thumbnail, ...frame, ...scan)).toBe(false)
  })
})
