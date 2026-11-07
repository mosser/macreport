import type { Document } from '../domain/document.ts'
import { type Field, fieldNames } from '../domain/findings.ts'
import type { Kind } from '../domain/kind.ts'
import type { Report } from '../domain/report.ts'
import { fieldName, fieldRule } from './field.ts'
import { html, type Markup } from './html.ts'
import type { Context } from './step.ts'

/** Reads a file the Claimant adds into a document of a kind. */
export type ReadFile = (file: File, kind: Kind) => Promise<Document>

/** A field of documents of one kind: where they are in the report, and how one is added. */
export interface DocumentField {
  readonly field: Field
  readonly kind: Kind
  /** Whether a document is removed from the field, rather than replaced by the next one added. */
  readonly isRemovable: boolean
  /** The documents of the field, in the order they were added. */
  documentsIn(report: Report): readonly Document[]
  /** The report, with a document added to the field. */
  afterAdding(report: Report, document: Document): Report
}

const accepted = 'application/pdf,image/jpeg,image/png'

/** A document added: its name, which the Claimant may change, its file name, and Remove. */
function documentItem(field: DocumentField, document: Document, index: number): Markup {
  const id = `file-of-${field.field}-${index}`
  const remove = field.isRemovable
    ? html`<button type="button" data-remove="${field.field}" data-index="${index}">Remove</button>`
    : ''
  return html`<li class="document">
    <label class="document-name">
      <span class="field-name">${fieldNames.documentName}</span>
      <input name="documentName" type="text" data-of="${field.field}" data-index="${index}"
        value="${document.name}" placeholder="${document.afterNaming('').name}" aria-describedby="${id}" />
    </label>
    <span class="file-name" id="${id}">${document.fileName}</span>
    ${remove}
  </li>`
}

/** A zone a file is dropped on, or clicked to choose one, then the documents added, each named. */
export function documentFieldOf(field: DocumentField, report: Report): Markup {
  const name = field.field
  const documents = field.documentsIn(report)
  const list =
    documents.length > 0
      ? html`<ul class="documents">${documents.map((document, index) => documentItem(field, document, index))}</ul>`
      : ''
  return html`<div class="field">
    ${fieldName(name)}
    <label class="drop-zone" data-drop="${name}">
      <input name="${name}" type="file" accept="${accepted}"
        aria-labelledby="name-of-${name} content-of-${name}" />
      <span id="content-of-${name}">Drop a file here, or choose one</span>
    </label>
    ${fieldRule(name)}
    ${list}
  </div>`
}

/**
 * Listens to the document fields of a panel: a file chosen or dropped is added, a name typed
 * names its document, and Remove takes a document out of the report.
 */
export function listenToDocumentFields(
  panel: HTMLElement,
  context: Context,
  readFile: ReadFile,
  fields: readonly DocumentField[],
): void {
  const fieldNamed = (name: string | undefined) => fields.find((field) => field.field === name)
  const documentOf = (element: HTMLElement) =>
    fieldNamed(element.dataset.of ?? element.dataset.remove)?.documentsIn(context.report)[
      Number(element.dataset.index)
    ]

  /** Chosen or dropped, a file goes through the same handler. */
  const add = async (name: string | undefined, file: File | undefined) => {
    const field = fieldNamed(name)
    if (field === undefined || file === undefined) return
    const session = context.session
    const document = await readFile(file, field.kind)
    if (context.session !== session) return
    context.change(field.afterAdding(context.report, document))
    context.refresh()
  }
  for (const element of panel.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
    element.addEventListener('change', () => {
      void add(element.name, element.files?.[0])
    })
  }
  for (const zone of panel.querySelectorAll<HTMLElement>('[data-drop]')) {
    const isOver = (over: boolean) => (event: Event) => {
      event.preventDefault()
      zone.classList.toggle('is-dragged-over', over)
    }
    zone.addEventListener('dragenter', isOver(true))
    zone.addEventListener('dragover', isOver(true))
    zone.addEventListener('dragleave', isOver(false))
    zone.addEventListener('drop', (event) => {
      isOver(false)(event)
      void add(zone.dataset.drop, (event as DragEvent).dataTransfer?.files[0])
    })
  }
  for (const element of panel.querySelectorAll<HTMLInputElement>('input[name="documentName"]')) {
    element.addEventListener('input', () => {
      const document = documentOf(element)
      if (document === undefined) return
      context.change(context.report.afterRenaming(document, element.value))
      context.refreshActions()
    })
  }
  for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-remove]')) {
    button.addEventListener('click', () => {
      const document = documentOf(button)
      if (document === undefined) return
      context.change(context.report.afterRemoving(document))
      context.refresh()
    })
  }
}
