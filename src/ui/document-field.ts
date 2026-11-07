import type { Document } from '../domain/document.ts'
import {
  alreadyInReportWording,
  type Field,
  fieldNames,
  nameTakenWording,
} from '../domain/findings.ts'
import type { Kind } from '../domain/kind.ts'
import type { Report } from '../domain/report.ts'
import { fieldName, fieldRule } from './field.ts'
import { html, type Markup } from './html.ts'
import { trashCan } from './icons.ts'
import type { Context } from './step.ts'

/** Reads a file the Claimant adds into a document of a kind. */
export type ReadFile = (file: File, kind: Kind) => Promise<Document>

/** A field of documents of one kind: where they are in the report, and how one is added. */
export interface DocumentField {
  readonly field: Field
  readonly kind: Kind
  /** Whether the field holds one document at most: once it has one, no other can be added. */
  readonly holdsOneDocument: boolean
  /** The documents of the field, in the order they were added. */
  documentsIn(report: Report): readonly Document[]
  /** The report, with a document added to the field. */
  afterAdding(report: Report, document: Document): Report
  /** The report, with a document taken out of the field. */
  afterRemoving(report: Report, document: Document): Report
  /**
   * The documents already in the report the Claimant may choose for the field, rather than add a
   * file: a field that offers them chooses the document already there for a file added again.
   */
  choicesIn?(report: Report): readonly Document[]
}

const accepted = 'application/pdf,image/jpeg,image/png'

/**
 * A document added: its name, which the Claimant may change, its file name, and Remove; under its
 * name, an error when a document before it already has it.
 */
function documentItem(
  field: DocumentField,
  report: Report,
  document: Document,
  index: number,
): Markup {
  const id = `file-of-${field.field}-${index}`
  const isTaken = report.isNameTaken(document) ? '' : html`hidden`
  return html`<li class="document">
    <label class="document-name">
      <span class="field-name">${fieldNames.documentName}</span>
      <input name="documentName" type="text" data-of="${field.field}" data-index="${index}"
        value="${document.name}" placeholder="${document.afterNaming('').name}" aria-describedby="${id}" />
    </label>
    <span class="file-name" id="${id}">${document.fileName}</span>
    <button type="button" class="icon remove" data-remove="${field.field}" data-index="${index}"
      aria-label="Remove" title="Remove">${trashCan}</button>
    <span class="error" role="alert" data-name-taken="${field.field}-${index}" ${isTaken}>${nameTakenWording}</span>
  </li>`
}

/** The documents already in the report the Claimant may choose for a field, by their names. */
function choicesOf(field: DocumentField, report: Report): Markup {
  const choices = field.choicesIn?.(report) ?? []
  if (choices.length === 0) return html``
  const name = field.field
  const options = choices.map(
    (document, index) => html`<option value="${index}">${document.name}</option>`,
  )
  return html`<label class="choice">
    <span class="field-name">Or choose one already added</span>
    <select name="choose-${name}" data-choose="${name}">
      <option value="" selected></option>
      ${options}
    </select>
  </label>`
}

/**
 * The documents added to a field, each named, then a zone a file is dropped on, or clicked to
 * choose one, and the documents already in the report it may choose; a field that holds one
 * document at most shows neither once it has it. Under a document chosen again for a file added
 * again, the step says so.
 */
export function documentFieldOf(
  field: DocumentField,
  report: Report,
  chosenAgain?: Document,
): Markup {
  const name = field.field
  const documents = field.documentsIn(report)
  const list =
    documents.length > 0
      ? html`<ul class="documents">${documents.map((document, index) => documentItem(field, report, document, index))}</ul>`
      : ''
  const status =
    chosenAgain !== undefined && documents.includes(chosenAgain)
      ? html`<p class="status" role="status">${alreadyInReportWording(chosenAgain)}</p>`
      : ''
  const isFull = field.holdsOneDocument && documents.length > 0
  const several = field.holdsOneDocument ? '' : html`multiple`
  const zone = isFull
    ? ''
    : html`<label class="drop-zone" data-drop="${name}">
        <input name="${name}" type="file" accept="${accepted}" ${several}
          aria-labelledby="name-of-${name} content-of-${name}" />
        <span id="content-of-${name}">Drop a file here, or choose one</span>
      </label>
      ${fieldRule(name)}
      ${choicesOf(field, report)}`
  return html`<div class="field" data-field="${name}">
    ${fieldName(name)}
    ${list}
    ${status}
    ${zone}
  </div>`
}

/**
 * The last file added to the report of each wizard, and the report it is for: the next file for
 * the same report is added once it is, so that files are added in the order the Claimant gave
 * them, however long each takes to read. A new report waits for none of the files of the last.
 */
const lastAdded = new WeakMap<
  Context,
  { readonly session: number; readonly addition: Promise<unknown> }
>()

/**
 * Listens to the document fields of a panel: a file chosen or dropped is added, a document
 * already in the report chosen, a name typed names its document, and Remove takes a document out
 * of its field. A field that offers the documents already in the report chooses the one already
 * there for a file added again, and says so through `isChosenAgain`.
 */
export function listenToDocumentFields(
  panel: HTMLElement,
  context: Context,
  readFile: ReadFile,
  fields: readonly DocumentField[],
  isChosenAgain: (field: DocumentField, document: Document) => void = () => undefined,
): void {
  const fieldNamed = (name: string | undefined) => fields.find((field) => field.field === name)
  const documentOf = (element: HTMLElement) =>
    fieldNamed(element.dataset.of ?? element.dataset.remove)?.documentsIn(context.report)[
      Number(element.dataset.index)
    ]

  /** Shows the error under each name a document before it already has, and only there. */
  const showTakenNames = () => {
    for (const element of panel.querySelectorAll<HTMLInputElement>('input[name="documentName"]')) {
      const document = documentOf(element)
      const isTaken = document !== undefined && context.report.isNameTaken(document)
      panel
        .querySelector(`[data-name-taken="${element.dataset.of}-${element.dataset.index}"]`)
        ?.toggleAttribute('hidden', !isTaken)
    }
  }

  /**
   * A file is read at once, and added once the file given before it is: to a report that has not
   * changed for another, and to a field of one document that does not have it yet.
   */
  const addOne = (field: DocumentField, file: File) => {
    const session = context.session
    const reading = readFile(file, field.kind)
    const last = lastAdded.get(context)
    const before = last?.session === session ? last.addition : Promise.resolve()
    const addition = before.then(async () => {
      const document = await reading
      if (context.session !== session) return
      if (field.holdsOneDocument && field.documentsIn(context.report).length > 0) return
      const already =
        field.choicesIn === undefined ? undefined : context.report.documentLike(document)
      if (already !== undefined) {
        isChosenAgain(field, already)
        context.change(field.afterAdding(context.report, already))
      } else {
        const named = document.afterNaming(context.report.freeNameLike(document.name))
        context.change(field.afterAdding(context.report, named))
      }
      context.refresh()
    })
    lastAdded.set(context, { session, addition: addition.catch(() => undefined) })
    context.adding(addition)
  }

  /** Chosen or dropped, files go through the same handler: each, or the first for one document. */
  const add = (name: string | undefined, files: FileList | null | undefined) => {
    const field = fieldNamed(name)
    if (field === undefined) return
    const given = Array.from(files ?? [])
    for (const file of field.holdsOneDocument ? given.slice(0, 1) : given) {
      addOne(field, file)
    }
  }
  for (const element of panel.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
    element.addEventListener('change', () => {
      add(element.name, element.files)
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
      add(zone.dataset.drop, (event as DragEvent).dataTransfer?.files)
    })
  }
  for (const element of panel.querySelectorAll<HTMLInputElement>('input[name="documentName"]')) {
    element.addEventListener('input', () => {
      const document = documentOf(element)
      if (document === undefined) return
      context.change(context.report.afterRenaming(document, element.value))
      showTakenNames()
      context.refreshActions()
    })
  }
  for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-remove]')) {
    button.addEventListener('click', () => {
      const field = fieldNamed(button.dataset.remove)
      const document = documentOf(button)
      if (field === undefined || document === undefined) return
      context.change(field.afterRemoving(context.report, document))
      context.refresh()
    })
  }
  for (const select of panel.querySelectorAll<HTMLSelectElement>('[data-choose]')) {
    select.addEventListener('change', () => {
      const field = fieldNamed(select.dataset.choose)
      const document = field?.choicesIn?.(context.report)[Number(select.value)]
      if (field === undefined || document === undefined || select.value === '') return
      context.change(field.afterAdding(context.report, document))
      context.refresh()
    })
  }
}
