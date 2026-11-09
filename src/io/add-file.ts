import { PDFDocument } from '@cantoo/pdf-lib'
import { Document } from '../domain/document.ts'
import { type RefusalReason, RefusedFile } from '../domain/findings.ts'
import type { Kind } from '../domain/kind.ts'
import { recognizedFormatOf } from './format.ts'

/** What the message of the PDF library says of a PDF protected by a password. */
const encrypted = /encrypted/i

/** Why a PDF cannot be added, read as the report document reads it; nothing when it can. */
async function refusalOfPdf(content: Uint8Array): Promise<RefusalReason | undefined> {
  try {
    const pdf = await PDFDocument.load(content)
    return pdf.getPageCount() === 0 ? 'without pages' : undefined
  } catch (error) {
    return error instanceof Error && encrypted.test(error.message) ? 'password' : 'damaged'
  }
}

/** Why an image cannot be added, embedded as the report document embeds it; nothing when it can. */
async function refusalOfImage(
  content: Uint8Array,
  format: 'jpeg' | 'png',
): Promise<RefusalReason | undefined> {
  try {
    const pdf = await PDFDocument.create()
    await (format === 'png' ? pdf.embedPng(content) : pdf.embedJpg(content))
    return undefined
  } catch {
    return 'damaged'
  }
}

/** Why a file of these bytes cannot be added, whatever its name says; nothing when it can. */
async function refusalOf(content: Uint8Array): Promise<RefusalReason | undefined> {
  const format = recognizedFormatOf(content)
  if (format === undefined) return 'format'
  return format === 'pdf' ? refusalOfPdf(content) : refusalOfImage(content, format)
}

/**
 * The document of a kind a file the Claimant adds becomes, read in the browser. Throws a
 * RefusedFile, with the reason, when it is of another format than a PDF, a JPEG image or a PNG
 * image, damaged, a PDF without pages, or a PDF protected by a password.
 */
export async function documentOf(file: File, kind: Kind): Promise<Document> {
  const content = new Uint8Array(await file.arrayBuffer())
  const reason = await refusalOf(content)
  if (reason !== undefined) throw new RefusedFile(file.name, reason)
  return new Document(kind, file.name, content)
}
