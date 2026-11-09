import { PDFDocument } from '@cantoo/pdf-lib'
import { type AddedFile, Document } from '../domain/document.ts'
import { type RefusalReason, RefusedFile } from '../domain/findings.ts'
import type { Kind } from '../domain/kind.ts'
import { recognizedFormatOf } from './format.ts'
import { isWholeJpeg } from './jpeg.ts'
import { isUnlockedOnReading, PdfWithoutPages } from './load-pdf.ts'

/** What the message of the PDF library says of a PDF that needs a password to open. */
const needsPassword = /password/i

/** Whether a PDF had to be unlocked; refused when it cannot be added, read as the report reads it. */
async function isPdfUnlocked(content: Uint8Array, fileName: string): Promise<boolean> {
  try {
    return await isUnlockedOnReading(content)
  } catch (error) {
    throw new RefusedFile(fileName, reasonOf(error))
  }
}

/** Why a PDF could not be read. */
function reasonOf(error: unknown): RefusalReason {
  if (error instanceof PdfWithoutPages) return 'without pages'
  return error instanceof Error && needsPassword.test(error.message) ? 'password' : 'damaged'
}

/** Why an image cannot be added, embedded as the report document embeds it; nothing when it can. */
async function refusalOfImage(
  content: Uint8Array,
  format: 'jpeg' | 'png',
): Promise<RefusalReason | undefined> {
  if (format === 'jpeg' && !isWholeJpeg(content)) return 'damaged'
  try {
    const pdf = await PDFDocument.create()
    await (format === 'png' ? pdf.embedPng(content) : pdf.embedJpg(content))
    return undefined
  } catch {
    return 'damaged'
  }
}

/**
 * The file the Claimant adds, read in the browser, into a document of a kind: whether it had to be
 * unlocked says a password restricted it, though it opens without one. Goes by what the file is,
 * whatever its name says. Throws a RefusedFile, with the reason, when it is of another format than
 * a PDF, a JPEG image or a PNG image, damaged, a PDF without pages, or a PDF that needs a password
 * to open.
 */
export async function addedFileOf(file: File, kind: Kind): Promise<AddedFile> {
  const content = new Uint8Array(await file.arrayBuffer())
  const format = recognizedFormatOf(content)
  if (format === undefined) throw new RefusedFile(file.name, 'format')
  if (format !== 'pdf') {
    const reason = await refusalOfImage(content, format)
    if (reason !== undefined) throw new RefusedFile(file.name, reason)
  }
  const wasUnlocked = format === 'pdf' && (await isPdfUnlocked(content, file.name))
  return { document: new Document(kind, file.name, content), wasUnlocked }
}
