/**
 * Hands the bytes of the report document to the browser, which writes it on the Claimant's
 * computer under the file name given. Nothing crosses a network.
 */
export function save(bytes: Uint8Array, fileName: string, page: globalThis.Document): void {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = page.createElement('a')
  link.href = url
  // The HTML attribute that makes a link save its target under a name (ADR 0009).
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
