/** A rectangle of a page, in the page's own coordinates. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** A quarter turn a page shows with, clockwise on screen, as a PDF's /Rotate says it. */
export type Rotation = 0 | 90 | 180 | 270

/**
 * A page as it shows on screen: its crop box, turned by its rotation. A point of the view is
 * measured from the bottom left of the page as it shows, rightwards then upwards.
 */
export interface PageView {
  readonly width: number
  readonly height: number
  readonly rotation: Rotation
  /** Where a point of the view falls in the page's own coordinates. */
  toPage(right: number, up: number): { readonly x: number; readonly y: number }
  /** A rectangle of the view, in the page's own coordinates. */
  boxOnPage(view: Box): Box
}

/** A rotation in degrees, any multiple of 90, as one of the four quarter turns. */
export function rotationOf(degrees: number): Rotation {
  return ((((Math.round(degrees / 90) * 90) % 360) + 360) % 360) as Rotation
}

/** How a page with this crop box and rotation shows on screen. */
export function viewOf(box: Box, degrees: number): PageView {
  const rotation = rotationOf(degrees)
  const isSideways = rotation === 90 || rotation === 270
  const toPage = (right: number, up: number) => {
    switch (rotation) {
      case 90:
        return { x: box.x + box.width - up, y: box.y + right }
      case 180:
        return { x: box.x + box.width - right, y: box.y + box.height - up }
      case 270:
        return { x: box.x + up, y: box.y + box.height - right }
      default:
        return { x: box.x + right, y: box.y + up }
    }
  }
  return {
    width: isSideways ? box.height : box.width,
    height: isSideways ? box.width : box.height,
    rotation,
    toPage,
    boxOnPage(view: Box): Box {
      const one = toPage(view.x, view.y)
      const other = toPage(view.x + view.width, view.y + view.height)
      return {
        x: Math.min(one.x, other.x),
        y: Math.min(one.y, other.y),
        width: Math.abs(other.x - one.x),
        height: Math.abs(other.y - one.y),
      }
    },
  }
}

/**
 * The rotation that shows a page portrait: its own when it already does, otherwise a quarter more,
 * the top of its content to the left, as a landscape page is printed.
 */
export function portraitRotationOf(box: Box, degrees: number): Rotation {
  const view = viewOf(box, degrees)
  return view.width > view.height ? rotationOf(view.rotation + 270) : view.rotation
}

/** A sheet of paper, portrait: its width and height. */
export interface Sheet {
  readonly width: number
  readonly height: number
}

/** How a page fits a sheet: the factor its content is scaled by, and its box once scaled. */
export interface Fit {
  readonly scale: number
  /** The sheet, in the page's own coordinates once its content is scaled, centred on it. */
  readonly box: Box
}

/**
 * How a page with this crop box and rotation fits a sheet, portrait or landscape as the page
 * shows, within margins: scaled down to fit them, never enlarged, and centred.
 */
export function fitOf(box: Box, degrees: number, sheet: Sheet, margin: number): Fit {
  const view = viewOf(box, degrees)
  const isLandscape = view.width > view.height
  const isSideways = view.rotation === 90 || view.rotation === 270
  const [width, height] =
    isLandscape === isSideways ? [sheet.width, sheet.height] : [sheet.height, sheet.width]
  const scale = Math.min(1, (width - 2 * margin) / box.width, (height - 2 * margin) / box.height)
  return {
    scale,
    box: {
      x: box.x * scale + (box.width * scale - width) / 2,
      y: box.y * scale + (box.height * scale - height) / 2,
      width,
      height,
    },
  }
}
