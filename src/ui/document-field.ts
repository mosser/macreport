import type { AddedFile, Document } from '../domain/document.ts'
import {
  alreadyInReportWording,
  type Field,
  fieldNames,
  nameTakenWording,
  RefusedFile,
  refusalWording,
  refusedAsAlreadyInReportWording,
  unlockedWording,
} from '../domain/findings.ts'
import type { Kind } from '../domain/kind.ts'
import type { Report } from '../domain/report.ts'
import { fieldName, fieldRule } from './field.ts'
import { html, type Markup } from './html.ts'
import { cross, pen, trashCan } from './icons.ts'
import type { Context } from './step.ts'

/**
 * Reads a file the Claimant adds into a document of a kind, saying whether it had to be unlocked.
 * Rejects with a RefusedFile, with the reason, when the file cannot be added.
 */
export type ReadFile = (file: File, kind: Kind) => Promise<AddedFile>

/**
 * What a step says under its document fields, while it shows them: the document chosen again for a
 * file added again, the files refused, each with its reason, since a file was last given, and the
 * documents unlocked, while the field holds them.
 */
export class FieldNotes {
  private readonly chosenAgain = new Map<Field, Document>()
  private readonly refusals = new Map<Field, readonly string[]>()
  private readonly unlocked = new Map<Field, readonly Document[]>()

  /** The document chosen again for the field. */
  chosenAgainFor(field: Field): Document | undefined {
    return this.chosenAgain.get(field)
  }

  /** What is said of the files refused for the field. */
  refusalsFor(field: Field): readonly string[] {
    return this.refusals.get(field) ?? []
  }

  /** The documents among those given that were unlocked, whatever they were named since. */
  unlockedAmong(field: Field, documents: readonly Document[]): readonly Document[] {
    const unlocked = this.unlocked.get(field) ?? []
    return documents.filter((document) =>
      unlocked.some((other) => other.hasSameContentAs(document)),
    )
  }

  wasUnlocked(field: Field, document: Document): void {
    this.unlocked.set(field, [...(this.unlocked.get(field) ?? []), document])
  }

  choseAgain(field: Field, document: Document): void {
    this.chosenAgain.set(field, document)
  }

  refused(field: Field, wording: string): void {
    this.refusals.set(field, [...this.refusalsFor(field), wording])
  }

  /** Files are given to the field: what was said of those given before goes. */
  givenFilesTo(field: Field): void {
    this.refusals.delete(field)
  }

  forget(): void {
    this.chosenAgain.clear()
    this.refusals.clear()
    this.unlocked.clear()
  }
}

/**
 * What the Claimant may state of a field that holds no document, which then takes its place: Paid
 * in cash, of a bank statement; a missing receipt, of a receipt.
 */
export interface StatedInstead {
  /** What is offered, and said once stated. */
  readonly wording: string
  /** Whether the report states it. */
  isStatedIn(report: Report): boolean
  /** Whether what is stated can be changed, with a pen, by stating it again. */
  readonly isChangeable: boolean
  /**
   * States it, asking the Claimant what it takes when it takes something; gives whether it is
   * stated, which it is not when they cancel.
   */
  state(context: Context, page: globalThis.Document): Promise<boolean>
  /** The report, no longer stating it: the field asks for its document again. */
  afterTakingBack(report: Report): Report
}

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
  /** What the Claimant may state instead of adding a document; nothing when there is no such thing. */
  readonly statedInstead?: StatedInstead
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

/** What is stated in place of a field and of its name, Change, a pen, when it can be changed, and Take back, a cross. */
function statedOf(field: DocumentField, { wording, isChangeable }: StatedInstead): Markup {
  const change = isChangeable
    ? html`<button type="button" class="icon" data-change-stated="${field.field}"
        aria-label="Change: ${wording}" title="Change">${pen}</button>`
    : ''
  return html`<div class="field" data-field="${field.field}">
    <div class="stated">
      <span class="stated-wording">${wording}</span>
      ${change}
      <button type="button" class="icon remove" data-take-back="${field.field}"
        aria-label="Take back: ${wording}" title="Take back">${cross}</button>
    </div>
  </div>`
}

/** What a field that holds no document may state instead, on offer unless a file is being added. */
function offerOf(field: DocumentField): Markup {
  return field.statedInstead === undefined
    ? html``
    : html`<button type="button" class="quiet" data-state="${field.field}"
        data-held-while-adding>${field.statedInstead.wording}</button>`
}

/**
 * The documents added to a field, each named, then a zone a file is dropped on, or clicked to
 * choose one, the documents already in the report it may choose, and what it may state instead; a
 * field that holds one document at most shows none of these once it has it. What is stated takes
 * the place of the field. Under a document chosen again for a file added again, the step says so; under a field,
 * that a document it holds was unlocked, and why each file given to it was refused.
 */
export function documentFieldOf(field: DocumentField, report: Report, notes: FieldNotes): Markup {
  const name = field.field
  if (field.statedInstead?.isStatedIn(report)) {
    return statedOf(field, field.statedInstead)
  }
  const documents = field.documentsIn(report)
  const list =
    documents.length > 0
      ? html`<ul class="documents">${documents.map((document, index) => documentItem(field, report, document, index))}</ul>`
      : ''
  const chosenAgain = notes.chosenAgainFor(name)
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
      ${choicesOf(field, report)}
      ${offerOf(field)}`
  return html`<div class="field" data-field="${name}">
    ${fieldName(name)}
    ${list}
    ${status}
    ${notes
      .unlockedAmong(name, documents)
      .map((document) => html`<p class="notice" role="status">${unlockedWording(document)}</p>`)}
    ${notes.refusalsFor(name).map((wording) => html`<p class="error" role="alert">${wording}</p>`)}
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
 * of its field. A field that offers the documents already in the report chooses the one of its kind
 * already there for a file added again, and says so through its notes. A file that cannot be added,
 * or that is already a document it cannot choose, is refused, the notes saying why. What a field states instead
 * is stated, or taken back, the focus going on to the control that takes its place.
 */
export function listenToDocumentFields(
  panel: HTMLElement,
  context: Context,
  readFile: ReadFile,
  fields: readonly DocumentField[],
  notes: FieldNotes,
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
   * Adds a document read from a file to a field: the document already there when the field can
   * choose it, refused when it is already another document, named otherwise.
   */
  const addRead = (field: DocumentField, { document, wasUnlocked }: AddedFile) => {
    const report = context.report
    const chosen = field.choicesIn === undefined ? undefined : report.documentLike(document)
    const other = chosen ?? report.documentOfSameContentAs(document)
    if (chosen !== undefined) {
      notes.choseAgain(field.field, chosen)
      context.change(field.afterAdding(report, chosen))
    } else if (other !== undefined) {
      notes.refused(field.field, refusedAsAlreadyInReportWording(document.fileName, other))
    } else {
      const named = document.afterNaming(report.freeNameLike(document.name))
      if (wasUnlocked) notes.wasUnlocked(field.field, named)
      context.change(field.afterAdding(report, named))
    }
  }

  /** What is said of a file that could not be read into a document. */
  const refusalOf = (file: File, error: unknown) =>
    error instanceof RefusedFile ? error.message : refusalWording(file.name, 'damaged')

  /**
   * A file is read at once, and added once the file given before it is: to a report that has not
   * changed for another, and to a field of one document that does not have it yet. A file that
   * cannot be read is refused.
   */
  const addOne = (field: DocumentField, file: File) => {
    const session = context.session
    const reading = readFile(file, field.kind)
    const last = lastAdded.get(context)
    const before = last?.session === session ? last.addition : Promise.resolve()
    const addition = before.then(async () => {
      const added = await reading.catch((error: unknown) => refusalOf(file, error))
      if (context.session !== session) return
      if (typeof added === 'string') {
        notes.refused(field.field, added)
      } else if (!field.holdsOneDocument || field.documentsIn(context.report).length === 0) {
        addRead(field, added)
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
    if (given.length > 0 && notes.refusalsFor(field.field).length > 0) {
      notes.givenFilesTo(field.field)
      context.refresh()
    }
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
  const refreshFocusing = (selector: string) => {
    context.refresh()
    panel.ownerDocument.querySelector<HTMLElement>(selector)?.focus()
  }
  for (const button of panel.querySelectorAll<HTMLButtonElement>(
    '[data-state], [data-change-stated]',
  )) {
    button.addEventListener('click', async () => {
      const name = button.dataset.state ?? button.dataset.changeStated
      const stated = fieldNamed(name)?.statedInstead
      if (await stated?.state(context, panel.ownerDocument)) {
        refreshFocusing(`[data-take-back="${name}"]`)
      }
    })
  }
  for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-take-back]')) {
    button.addEventListener('click', () => {
      const name = button.dataset.takeBack
      const stated = fieldNamed(name)?.statedInstead
      if (stated === undefined) return
      context.change(stated.afterTakingBack(context.report))
      refreshFocusing(`[data-state="${name}"]`)
    })
  }
}
