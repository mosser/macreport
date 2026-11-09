import { raw } from './html.ts'

/** An icon of 18 pixels, drawn in the colour of the text of the button that holds it. */
function icon(paths: string) {
  return raw(
    `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`,
  )
}

/** Two arrows pointing at each other: Reduce. */
export const reduceArrows = icon(
  '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>',
)

/** A trash can: Remove. */
export const trashCan = icon(
  '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
)

/** A cross: Take back. */
export const cross = icon('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>')

/** A pen: Change. */
export const pen = icon('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>')
