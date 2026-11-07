const emailAddress = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A text the Claimant typed, in its composed form; absent when it is blank, never empty. */
export function textOrAbsent(text: string): string | undefined {
  return text.trim() === '' ? undefined : text.trim().normalize('NFC')
}

/** Whether the text is an email address. */
export function isEmailAddress(text: string): boolean {
  return emailAddress.test(text)
}
