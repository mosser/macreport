import {
  decodePDFRawStream,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
} from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { shareShapes } from './shared-shapes.ts'

const bytesOf = (text: string) =>
  Uint8Array.from([...text].map((character) => character.charCodeAt(0)))
const textOf = (bytes: Uint8Array) => String.fromCharCode(...bytes)

/** A glyph-like outline at a place: long enough to be worth sharing. */
const outline = (x: number, y: number, paint = 'f') =>
  [
    `${x} ${y} m`,
    `${x + 1.2345} ${y + 2.3456} l`,
    `${x + 3.1} ${y + 2.5} ${x + 4.2} ${y + 1.75} ${x + 5.5} ${y} c`,
    `${x + 2.5} ${y - 1.25} l h ${paint}`,
  ].join(' ')

/** A PDF with a page per content stream given, and the content of each as it stands. */
async function pdfDrawing(...contents: (string | Uint8Array)[]): Promise<PDFDocument> {
  const pdf = await PDFDocument.create()
  for (const content of contents) {
    const page = pdf.addPage([612, 792])
    const bytes = typeof content === 'string' ? bytesOf(content) : content
    page.node.set(PDFName.of('Contents'), pdf.context.register(pdf.context.flateStream(bytes)))
  }
  return pdf
}

function contentOf(pdf: PDFDocument, index: number): string {
  const page = pdf.getPage(index)
  const stream = pdf.context.lookup(page.node.get(PDFName.of('Contents')))
  if (!(stream instanceof PDFRawStream)) throw new TypeError('A page without a stream')
  return textOf(decodePDFRawStream(stream).decode())
}

/** The forms a page can draw, by name. */
function formsOf(pdf: PDFDocument, index: number): Map<string, PDFRawStream> {
  const resources = pdf.getPage(index).node.Resources()
  const objects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict)
  const forms = new Map<string, PDFRawStream>()
  for (const [key, value] of objects?.entries() ?? []) {
    const form = pdf.context.lookup(value)
    if (form instanceof PDFRawStream) forms.set(key.decodeText(), form)
  }
  return forms
}

/** The drawings of forms in a page's content: which, and where. */
function drawingsOf(content: string): { x: number; y: number; name: string }[] {
  return [...content.matchAll(/q 1 0 0 1 (\S+) (\S+) cm \/(\S+) Do Q/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    name: match[3] ?? '',
  }))
}

/** Every coordinate of a path, in order. */
const numbersOf = (text: string) => [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number)

describe('shareShapes', () => {
  it('keeps a shape drawn twice once, and draws it from each place', async () => {
    const pdf = await pdfDrawing(`${outline(100, 200)}\n${outline(300.25, 400.5)}`)
    shareShapes(pdf)
    const forms = formsOf(pdf, 0)
    expect(forms.size).toBe(1)
    expect(drawingsOf(contentOf(pdf, 0))).toEqual([
      { x: 100, y: 200, name: 'McS0' },
      { x: 300.25, y: 400.5, name: 'McS0' },
    ])
  })

  it('draws each point within 0.01 point of where it was', async () => {
    const original = [outline(100.123, 200.456), outline(250.789, 300.987)]
    const pdf = await pdfDrawing(original.join('\n'))
    shareShapes(pdf)
    const [form] = [...formsOf(pdf, 0).values()]
    if (form === undefined) throw new TypeError('No form')
    const relative = numbersOf(textOf(decodePDFRawStream(form).decode()))
    drawingsOf(contentOf(pdf, 0)).forEach(({ x, y }, shape) => {
      const expected = numbersOf(original[shape] ?? '')
      const drawn = relative.map((value, index) => value + (index % 2 === 0 ? x : y))
      expect(drawn).toHaveLength(expected.length)
      expected.forEach((value, index) => {
        expect(Math.abs((drawn[index] ?? 0) - value)).toBeLessThanOrEqual(0.0101)
      })
    })
  })

  it('writes a form with a box around all of its shape', async () => {
    const pdf = await pdfDrawing(`${outline(100, 200)} ${outline(300, 400)}`)
    shareShapes(pdf)
    const [form] = [...formsOf(pdf, 0).values()]
    expect(form?.dict.get(PDFName.of('Subtype'))).toBe(PDFName.of('Form'))
    expect(form?.dict.lookup(PDFName.of('BBox'))?.toString()).toBe('[ -1 -2.25 6.5 3.5 ]')
  })

  it('keeps the far corner of a rectangle in a path within 0.01 point', async () => {
    const shape = (y: number) =>
      `100.0049 ${y} m 101.5 ${y + 2.5} l 103.25 ${y + 4.75} l h 110.0098 ${y} 20.0049 5 re f`
    const pdf = await pdfDrawing(`${shape(50)} ${shape(150)}`)
    shareShapes(pdf)
    const [form] = [...formsOf(pdf, 0).values()]
    if (form === undefined) throw new TypeError('No form')
    const rectangle = /(\S+) \S+ (\S+) \S+ re/.exec(textOf(decodePDFRawStream(form).decode()))
    const [drawn] = drawingsOf(contentOf(pdf, 0))
    const farCorner = (drawn?.x ?? 0) + Number(rectangle?.[1]) + Number(rectangle?.[2])
    expect(Math.abs(farCorner - 130.0147)).toBeLessThanOrEqual(0.0101)
  })

  it('leaves the shapes of a page its unit enlarges on it, and shares those of others', async () => {
    const shapes = `${outline(10, 20)} ${outline(30, 40)}`
    const pdf = await pdfDrawing(shapes, shapes, shapes)
    pdf.getPage(0).node.set(PDFName.of('UserUnit'), pdf.context.obj(100))
    pdf.getPage(1).node.set(PDFName.of('UserUnit'), pdf.context.obj(1))
    shareShapes(pdf)
    expect(contentOf(pdf, 0)).toBe(shapes)
    expect(drawingsOf(contentOf(pdf, 1))).toHaveLength(2)
    expect(drawingsOf(contentOf(pdf, 2))).toHaveLength(2)
  })

  it('shares a shape across pages, and only adds it to the pages that draw it', async () => {
    const pdf = await pdfDrawing(outline(10, 20), outline(30, 40), 'BT ET')
    shareShapes(pdf)
    expect(formsOf(pdf, 0).get('McS0')).toBe(formsOf(pdf, 1).get('McS0'))
    expect(formsOf(pdf, 2).size).toBe(0)
    expect(contentOf(pdf, 2)).toBe('BT ET')
  })

  it('leaves a shape drawn once on its page', async () => {
    const content = outline(100, 200)
    const pdf = await pdfDrawing(content)
    shareShapes(pdf)
    expect(contentOf(pdf, 0)).toBe(content)
    expect(formsOf(pdf, 0).size).toBe(0)
  })

  it('leaves a short shape on its page: a form would not make it smaller', async () => {
    const content = '10 20 5 5 re f 30 40 5 5 re f'
    const pdf = await pdfDrawing(content)
    shareShapes(pdf)
    expect(contentOf(pdf, 0)).toBe(content)
  })

  it('tells shapes apart by their paint', async () => {
    const pdf = await pdfDrawing(
      [outline(1, 1), outline(2, 2), outline(3, 3, 'f*'), outline(4, 4, 'f*')].join(' '),
    )
    shareShapes(pdf)
    expect(formsOf(pdf, 0).size).toBe(2)
  })

  it('takes a capital F for the same paint as f', async () => {
    const pdf = await pdfDrawing(`${outline(1, 1)} ${outline(2, 2, 'F')}`)
    shareShapes(pdf)
    expect(formsOf(pdf, 0).size).toBe(1)
  })

  it('shares a shape opening with a rectangle', async () => {
    const shape = (x: number, y: number) =>
      `${x} ${y} 10.5 20.25 re ${x + 2} ${y + 2} m ${x + 3} ${y + 4} l ${x + 5} ${y + 6} l ${x + 7} ${y + 8} l h f`
    const pdf = await pdfDrawing(`${shape(10, 20)} ${shape(100, 200)}`)
    shareShapes(pdf)
    const [form] = [...formsOf(pdf, 0).values()]
    if (form === undefined) throw new TypeError('No form')
    expect(textOf(decodePDFRawStream(form).decode())).toBe(
      '0 0 10.5 20.25 re 2 2 m 3 4 l 5 6 l 7 8 l h f',
    )
  })

  it.each([
    ['stroked', 'S'],
    ['filled and stroked', 'B'],
    ['a clip', 'W n'],
    ['never painted', 'n'],
  ])('leaves a path %s on its page', async (_what, paint) => {
    const content = `${outline(1, 1, paint)} ${outline(2, 2, paint)}`
    const pdf = await pdfDrawing(content)
    shareShapes(pdf)
    expect(contentOf(pdf, 0)).toBe(content)
  })

  it('leaves a page holding an inline image as it is', async () => {
    const content = `${outline(1, 1)} ${outline(2, 2)} BI /W 1 /H 1 ID x EI`
    const pdf = await pdfDrawing(content)
    shareShapes(pdf)
    expect(contentOf(pdf, 0)).toBe(content)
  })

  it('leaves shapes under a transform that enlarges, and shares those under one that does not', async () => {
    const enlarged = `q 2 0 0 2 0 0 cm ${outline(1, 1)} ${outline(2, 2)} Q`
    const reduced = `q 0.5 0 0 0.5 0 0 cm ${outline(3, 3)} ${outline(4, 4)} Q`
    const pdf = await pdfDrawing(`${enlarged} ${reduced}`)
    shareShapes(pdf)
    const content = contentOf(pdf, 0)
    expect(content).toContain(enlarged)
    expect(drawingsOf(content)).toHaveLength(2)
  })

  it('counts what transforms add up to, and what Q takes back', async () => {
    const adding = `q 0.5 0 0 0.5 0 0 cm 4 0 0 4 0 0 cm ${outline(1, 1)} ${outline(2, 2)} Q`
    const backToOne = `q 3 0 0 3 0 0 cm Q ${outline(5, 5)} ${outline(6, 6)}`
    const pdf = await pdfDrawing(`${adding} ${backToOne}`)
    shareShapes(pdf)
    const content = contentOf(pdf, 0)
    expect(content).toContain(adding)
    expect(drawingsOf(content)).toHaveLength(2)
  })

  it('takes a turn for a transform that does not enlarge', async () => {
    const pdf = await pdfDrawing(`q 0 1 -1 0 0 0 cm ${outline(1, 1)} ${outline(2, 2)} Q`)
    shareShapes(pdf)
    expect(drawingsOf(contentOf(pdf, 0))).toHaveLength(2)
  })

  it('leaves a shape filled with a pattern on its page, until the colour changes', async () => {
    const patterned = `/Pattern cs /P1 scn ${outline(1, 1)} ${outline(2, 2)}`
    const plain = `0.5 g ${outline(3, 3)} ${outline(4, 4)}`
    const pdf = await pdfDrawing(`${patterned} ${plain}`)
    shareShapes(pdf)
    const content = contentOf(pdf, 0)
    expect(content).toContain(patterned)
    expect(drawingsOf(content)).toHaveLength(2)
  })

  it('takes a colour a pattern space sets with numbers for no pattern', async () => {
    const pdf = await pdfDrawing(`/Cs1 cs 0.1 0.2 0.3 scn ${outline(1, 1)} ${outline(2, 2)}`)
    shareShapes(pdf)
    expect(drawingsOf(contentOf(pdf, 0))).toHaveLength(2)
  })

  it('leaves text as it was, bytes that are no text included', async () => {
    const text = new Uint8Array([
      ...bytesOf('BT /F1 12 Tf 10 20 Td ('),
      0x80,
      0xff,
      0x66,
      ...bytesOf(') Tj ET'),
    ])
    const content = new Uint8Array([
      ...text,
      10,
      ...bytesOf(outline(1, 1)),
      10,
      ...bytesOf(outline(2, 2)),
    ])
    const pdf = await pdfDrawing(content)
    shareShapes(pdf)
    expect(contentOf(pdf, 0).startsWith(textOf(text))).toBe(true)
    expect(drawingsOf(contentOf(pdf, 0))).toHaveLength(2)
  })

  it.each([
    ['a colour', '1 0 0 rg'],
    ['a transform', '1 0 0 1 0 0 cm'],
    ['a saved state', 'q'],
    ['a clip', 'W'],
    ['a move whose operands are not its coordinates', '/Name 1 m'],
  ])('leaves on its page a shape in a path that %s interrupts', async (_what, interruption) => {
    const interrupted = (y: number) => `10 ${y} m 20 ${y} l ${interruption} ${outline(50, y)}`
    const content = `${interrupted(100)} ${interrupted(200)}`
    const pdf = await pdfDrawing(content)
    shareShapes(pdf)
    expect(contentOf(pdf, 0)).toBe(content)
    expect(formsOf(pdf, 0).size).toBe(0)
  })

  it('leaves on its page a shape after a line with no point before it', async () => {
    const content = `1 1 l ${outline(50, 100)} 1 1 l ${outline(50, 200)}`
    const pdf = await pdfDrawing(content)
    shareShapes(pdf)
    expect(contentOf(pdf, 0)).toBe(content)
  })

  it('leaves a shape in a text object on its page, and shares those after it', async () => {
    const inText = `BT /F1 12 Tf ${outline(10, 20)} (a) Tj ET BT ${outline(30, 40)} ET`
    const pdf = await pdfDrawing(`${inText} ${outline(50, 60)} ${outline(70, 80)}`)
    shareShapes(pdf)
    const content = contentOf(pdf, 0)
    expect(content.startsWith(inText)).toBe(true)
    expect(drawingsOf(content).map(({ x, y }) => [x, y])).toEqual([
      [50, 60],
      [70, 80],
    ])
  })

  it('shares the shapes again once a path interrupted is painted', async () => {
    const content = `10 10 m 1 0 0 rg ${outline(50, 50)} ${outline(100, 100)} ${outline(200, 200)}`
    const pdf = await pdfDrawing(content)
    shareShapes(pdf)
    expect(drawingsOf(contentOf(pdf, 0))).toHaveLength(2)
  })

  it('leaves a path whose operands are not its coordinates on its page', async () => {
    const broken = `1 m ${outline(2, 2)}`
    const other = '/Name 1 m 2 3 l 4 5 l 6 7 l h f'
    const pdf = await pdfDrawing(`${broken} ${other} ${other}`)
    shareShapes(pdf)
    const content = contentOf(pdf, 0)
    expect(content).toContain(other)
    expect(drawingsOf(content)).toEqual([])
  })

  it('reads a page whose content is several streams, as one', async () => {
    const pdf = await pdfDrawing('')
    const streams = [outline(1, 1), outline(2, 2)].map((content) =>
      pdf.context.register(pdf.context.flateStream(content)),
    )
    pdf.getPage(0).node.set(PDFName.of('Contents'), pdf.context.obj(streams))
    shareShapes(pdf)
    expect(drawingsOf(contentOf(pdf, 0))).toHaveLength(2)
  })

  it('leaves a page whose string runs from one stream into the next as it is', async () => {
    const pdf = await pdfDrawing('')
    const parts = [`${outline(1, 1)} ${outline(2, 2)} BT (he`, 'llo) Tj ET']
    const streams = parts.map((part) => pdf.context.register(pdf.context.flateStream(part)))
    const contents = pdf.context.obj(streams)
    pdf.getPage(0).node.set(PDFName.of('Contents'), contents)
    shareShapes(pdf)
    expect(pdf.getPage(0).node.get(PDFName.of('Contents'))).toBe(contents)
    expect(formsOf(pdf, 0).size).toBe(0)
  })

  it('leaves a page it cannot read as it is', async () => {
    const pdf = await pdfDrawing(outline(1, 1))
    const stream = PDFRawStream.of(
      pdf.context.obj({ Filter: 'Unknown' }) as PDFDict,
      bytesOf(outline(2, 2)),
    )
    const reference = pdf.context.register(stream)
    pdf.getPage(0).node.set(PDFName.of('Contents'), reference)
    shareShapes(pdf)
    expect(pdf.getPage(0).node.get(PDFName.of('Contents'))).toBe(reference)
  })

  it('leaves a page without content as it is', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage([612, 792])
    expect(() => shareShapes(pdf)).not.toThrow()
  })

  it('gives its forms names no page already uses', async () => {
    const pdf = await pdfDrawing(`${outline(1, 1)} ${outline(2, 2)}`)
    const existing = pdf.context.register(pdf.context.flateStream(''))
    pdf.getPage(0).node.setXObject(PDFName.of('McS0'), existing)
    shareShapes(pdf)
    const forms = formsOf(pdf, 0)
    expect(drawingsOf(contentOf(pdf, 0))[0]?.name).toBe('McS1')
    expect(forms.get('McS0')).toBe(pdf.context.lookup(existing))
  })

  it('survives being saved and read back', async () => {
    const pdf = await pdfDrawing(`${outline(100, 200)} ${outline(300, 400)}`)
    shareShapes(pdf)
    const again = await PDFDocument.load(await pdf.save())
    expect(formsOf(again, 0).size).toBe(1)
    expect(again.getPage(0).node.get(PDFName.of('Contents'))).toBeInstanceOf(PDFRef)
  })

  it('makes a page of repeated shapes much smaller', async () => {
    const outlines: string[] = []
    for (let index = 0; index < 2000; index += 1) {
      outlines.push(outline(10 + (index % 40) * 13.37, 700 - Math.floor(index / 40) * 13.37))
    }
    const pdf = await pdfDrawing(outlines.join('\n'))
    const before = (await pdf.save()).length
    shareShapes(pdf)
    const stream = pdf.context.lookup(pdf.getPage(0).node.get(PDFName.of('Contents')))
    expect(stream instanceof PDFRawStream && stream.contents.length).toBeLessThan(before / 2)
  })
})
