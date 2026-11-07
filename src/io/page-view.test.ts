import { describe, expect, it } from 'vitest'
import { portraitRotationOf, rotationOf, viewOf } from './page-view.ts'

const letter = { x: 0, y: 0, width: 612, height: 792 }
const landscape = { x: 10, y: 20, width: 792, height: 612 }

describe('viewOf', () => {
  it('shows an unrotated page as it is', () => {
    const view = viewOf(letter, 0)
    expect([view.width, view.height]).toEqual([612, 792])
    expect(view.toPage(10, 20)).toEqual({ x: 10, y: 20 })
  })

  it('shows a page turned a quarter sideways, its bottom left where its top left was', () => {
    const clockwise = viewOf(letter, 90)
    expect([clockwise.width, clockwise.height]).toEqual([792, 612])
    expect(clockwise.toPage(0, 0)).toEqual({ x: 612, y: 0 })
    const anticlockwise = viewOf(letter, -90)
    expect(anticlockwise.rotation).toBe(270)
    expect(anticlockwise.toPage(0, 0)).toEqual({ x: 0, y: 792 })
  })

  it('shows a page upside down from its top right', () => {
    expect(viewOf(landscape, 180).toPage(0, 0)).toEqual({ x: 802, y: 632 })
  })

  it('places a rectangle of the view on the page, whatever the rotation', () => {
    expect(viewOf(letter, 90).boxOnPage({ x: 100, y: 24, width: 50, height: 10 })).toEqual({
      x: 578,
      y: 100,
      width: 10,
      height: 50,
    })
    expect(viewOf(letter, 0).boxOnPage({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    })
  })
})

describe('rotationOf', () => {
  it('brings any multiple of 90 degrees back to a quarter turn', () => {
    expect([0, 90, 180, 270, 360, 450, -90, -180].map(rotationOf)).toEqual([
      0, 90, 180, 270, 0, 90, 270, 180,
    ])
  })
})

describe('portraitRotationOf', () => {
  it('keeps a page that shows portrait, and turns one that shows landscape', () => {
    expect(portraitRotationOf(letter, 0)).toBe(0)
    expect(portraitRotationOf(letter, 180)).toBe(180)
    expect(portraitRotationOf(landscape, 0)).toBe(270)
    expect(portraitRotationOf(letter, 90)).toBe(0)
    expect(portraitRotationOf(landscape, 90)).toBe(90)
  })
})
