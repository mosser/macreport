/** Markup built by the system, inserted as it is. */
export class Markup {
  readonly text: string

  constructor(text: string) {
    this.text = text
  }

  toString(): string {
    return this.text
  }
}

/** A value interpolated into the `html` template. */
export type Interpolated = string | number | boolean | Markup | undefined | readonly Interpolated[]

/** Markup the system built itself; never text the Claimant typed or a file name. */
export function raw(markup: string): Markup {
  return new Markup(markup)
}

/** The text, escaped so that it reads as text in markup. */
export function escaped(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function markupOf(value: Interpolated): string {
  if (value instanceof Markup) return value.text
  if (Array.isArray(value)) return value.map(markupOf).join('')
  if (value === undefined || value === false || value === true) return ''
  return escaped(String(value))
}

/** A template of markup that escapes every interpolated value but markup and nested templates. */
export function html(strings: TemplateStringsArray, ...values: Interpolated[]): Markup {
  let text = strings[0] ?? ''
  values.forEach((value, index) => {
    text += markupOf(value) + (strings[index + 1] ?? '')
  })
  return new Markup(text)
}
