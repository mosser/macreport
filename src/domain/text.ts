/** A text the Claimant typed, in its composed form; absent when it is blank, never empty. */
export function textOrAbsent(text: string): string | undefined {
  return text.trim() === '' ? undefined : text.trim().normalize('NFC')
}

/**
 * Whether the text is an email address: no space, one @ with something before it, and after it a
 * domain with a dot that has something on both sides.
 */
export function isEmailAddress(text: string): boolean {
  const at = text.indexOf('@')
  if (/\s/.test(text) || at <= 0 || at !== text.lastIndexOf('@')) {
    return false
  }
  const domain = text.slice(at + 1)
  const dot = domain.lastIndexOf('.')
  return dot > 0 && dot < domain.length - 1
}
