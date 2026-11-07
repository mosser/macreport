import { Document } from '../domain/document.ts'
import type { Kind } from '../domain/kind.ts'

/** The document of a kind a file the Claimant adds becomes, read in the browser. */
export async function documentOf(file: File, kind: Kind): Promise<Document> {
  return new Document(kind, file.name, new Uint8Array(await file.arrayBuffer()))
}
