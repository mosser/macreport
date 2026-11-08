import { raw } from './html.ts'

/** An icon of 18 pixels, drawn in the colour of the text of the button that holds it. */
function icon(paths: string) {
  return raw(
    `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`,
  )
}

/** A question mark in a circle: Help. */
export const questionMark = icon(
  '<circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>',
)

/** Two arrows pointing at each other: Reduce. */
export const reduceArrows = icon(
  '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>',
)

/** A trash can: Remove. */
export const trashCan = icon(
  '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
)

/** A pen: Change. */
export const pen = icon('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>')
