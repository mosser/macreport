import type { Document } from '../domain/document.ts'
import { documentSizes, type ReportWeights, sizeText } from '../domain/document-sizes.ts'
import { fieldNames, findingsOf } from '../domain/findings.ts'
import { Kind } from '../domain/kind.ts'
import { type ExpenseRow, type Layout, layoutOf, type Section } from '../domain/layout.ts'
import { Meal } from '../domain/meal.ts'
import type { PerDiem } from '../domain/per-diem.ts'
import type { Report } from '../domain/report.ts'
import { type DocumentLinks, type LinkOf, linksAnew, namesOf } from './document-link.ts'
import { html, type Markup } from './html.ts'
import type { Context, Step } from './step.ts'

/** Writes the report document of a report without findings and hands it to the browser; gives its file name. */
export type SaveReport = (report: Report) => Promise<string>

/** Works out the sizes of a report's documents and of its report document. */
export type WeighReport = (report: Report) => Promise<ReportWeights>

/** Sizes being worked out for a report; its weights once they are known. */
interface Weighing {
  readonly report: Report
  weights?: ReportWeights
}

/** What a row of a document says of its size, and offers to change it. */
type SizeOf = (document: Document) => Markup

/** What an empty table of the Review step says, in grey, in a row across its columns. */
function emptyRow(columns: number, wording: string): Markup {
  return html`<tr class="empty"><td colspan="${columns}">${wording}</td></tr>`
}

/**
 * The cover: its fields, then each expense on two lines, the second its documents, or No expense
 * entered; the per diems of a business travel, under their own heading; then the total of the
 * report.
 */
function coverOf(layout: Layout, linkOf: LinkOf, isBusinessTravel: boolean): Markup {
  const fields = layout.coverFields.map(
    (field) => html`<tr><th scope="row">${field.name}</th><td>${field.value}</td></tr>`,
  )
  const rows = layout.expenses
    .filter((row) => row.perDiem === undefined)
    .map((row) => {
      const documents = row.supportingDocuments.map((supporting) => supporting.document)
      return html`<tr class="expense">
        <td>${row.number}</td><td class="date">${row.date}</td><td class="description">${row.description}</td>
        <td>${row.foreignAmount}</td><td>${row.claimedAmount}</td>
      </tr>
      <tr class="supporting"><td></td><td></td><td colspan="3">${namesOf(documents, linkOf)}</td></tr>`
    })
  return html`<table class="cover-fields">${fields}</table>
    <table class="expenses">
      <thead><tr>
        <th>#</th><th>Date</th><th>Description</th><th>Foreign amount</th><th>Claimed (CAD)</th>
      </tr></thead>
      <tbody>${rows.length > 0 ? rows : emptyRow(5, 'No expense entered')}</tbody>
    </table>
    ${isBusinessTravel ? perDiemsOf(layout.expenses) : ''}
    <table class="report-total">
      <tr class="total"><th scope="row">Total</th><td>${layout.total.map((line) => html`<div>${line}</div>`)}</td></tr>
    </table>`
}

/**
 * The per diems, one row per day with a meal claimed: its numbers on the cover, its date, domestic
 * or international, each meal claimed with its rate or not claimed with its reason, and its total,
 * one amount per currency; No per diem entered when there is none.
 */
function perDiemsOf(rows: readonly ExpenseRow[]): Markup {
  const numbers = new Map<PerDiem, number[]>()
  for (const { perDiem, number } of rows) {
    if (perDiem !== undefined) numbers.set(perDiem, [...(numbers.get(perDiem) ?? []), number])
  }
  const lines = [...numbers].map(([perDiem, numbered]) => {
    const meals = Meal.all.map((meal) => {
      if (perDiem.isClaiming(meal)) {
        return html`<td>${perDiem.rateTextOf(meal)}</td>`
      }
      const reason = perDiem.reasonFor(meal)
      const why = reason === undefined ? html`` : html`<div>${reason}</div>`
      return html`<td class="not-claimed">Not claimed${why}</td>`
    })
    const scopes = [
      ...(perDiem.mealsClaimedThat(false).length > 0 ? [fieldNames.domestic] : []),
      ...(perDiem.mealsClaimedThat(true).length > 0 ? [fieldNames.international] : []),
    ]
    return html`<tr>
      <td>${numbered.join(', ')}</td><td class="date">${perDiem.date.toString()}</td>
      <td>${scopes.join(', ')}</td>
      ${meals}<td>${perDiem.amountTexts.map((amount) => html`<div>${amount}</div>`)}</td>
    </tr>`
  })
  return html`<h3>Per diems</h3>
    <table class="per-diems">
      <thead><tr>
        <th>#</th><th>Date</th><th></th>${Meal.all.map((meal) => html`<th>${meal.title}</th>`)}<th>Total</th>
      </tr></thead>
      <tbody>${lines.length > 0 ? lines : emptyRow(Meal.all.length + 4, 'No per diem entered')}</tbody>
    </table>`
}

/**
 * What a row says of a document's size: its size before and after once reduced, with Restore; its
 * size when it is heavy, with Reduce when that is worth offering; nothing otherwise.
 */
function sizesOf(report: Report, weights: ReportWeights | undefined): SizeOf {
  return (document) => {
    const weight = weights?.weights.get(document)
    if (weight === undefined) return html``
    const index = report.documents.indexOf(document)
    if (document.isReduced) {
      return html`<div class="document-size">
        ${sizeText(weight.addedSize)} → ${sizeText(weight.size)}
        <button data-action="restore" data-document="${index}">Restore</button>
      </div>`
    }
    if (!documentSizes.isHeavy(weight.size)) return html``
    const reduce =
      weight.reducedSize === undefined
        ? html``
        : html`<button data-action="reduce" data-document="${index}">Reduce to ${sizeText(weight.reducedSize)}</button>`
    return html`<div class="document-size">${sizeText(weight.size)} ${reduce}</div>`
  }
}

/** The size of the report document, or that the sizes are not known yet. */
function reportSizeOf(weights: ReportWeights | undefined): Markup {
  if (weights === undefined) {
    return html`<p class="report-size is-pending">Working out the sizes…</p>`
  }
  return weights.reportDocumentSize === undefined
    ? html``
    : html`<p class="report-size">Report document: ${sizeText(weights.reportDocumentSize)}</p>`
}

function sectionsOf(layout: Layout, linkOf: LinkOf, sizeOf: SizeOf): Markup[] {
  return layout.sections.map((section) => {
    const expenses = (cell: Markup) => (section.listsExpenses ? cell : '')
    const table = (documents: Section['documents']) => {
      const rows = documents.map((entry) => {
        const descriptions = entry.expenses.map(
          ({ description }) => html`<div>${description}</div>`,
        )
        const numbers = html`<td>${descriptions}</td>`
        return html`<tr><td>${entry.label}</td><td>${linkOf(entry.document)}${sizeOf(entry.document)}</td>${expenses(numbers)}</tr>`
      })
      return html`<table class="documents">
        <colgroup><col class="label" /><col />${expenses(html`<col />`)}</colgroup>
        <thead><tr><th>Label</th><th>Name</th>${expenses(html`<th>Expenses</th>`)}</tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    }
    const content =
      section.subsections.length > 0
        ? section.subsections.map(
            (subsection) => html`<h4>${subsection.title}</h4>${table(subsection.documents)}`,
          )
        : table(section.documents)
    return html`<h3>${section.title}</h3>${content}`
  })
}

/**
 * Renders a panel anew, the focus staying on the control it was on, for a change the Claimant did
 * not ask for: a link is found again by its place among the links, a button by what it does.
 */
function keepingFocus(panel: HTMLElement, render: () => void): void {
  const focused = panel.ownerDocument.activeElement
  if (!(focused instanceof HTMLElement) || !panel.contains(focused)) {
    render()
    return
  }
  const link = [...panel.querySelectorAll<HTMLElement>('a')].indexOf(focused)
  const { action, document } = focused.dataset
  render()
  const again =
    link >= 0
      ? panel.querySelectorAll('a')[link]
      : [...panel.querySelectorAll<HTMLElement>('[data-action]')].find(
          ({ dataset }) => dataset.action === action && dataset.document === document,
        )
  again?.focus({ preventScroll: true })
}

/** What became of the last save: the report it was for, and its file name or that it failed. */
type Outcome =
  | { readonly report: Report; readonly fileName: string }
  | { readonly report: Report; readonly isFailed: true }

/** What the step says of the last save, only while the report is the one saved. */
function statusOf(outcome: Outcome | undefined, report: Report, isDraftKept: boolean): Markup {
  if (outcome?.report !== report) {
    return html``
  }
  if ('isFailed' in outcome) {
    return html`<p class="status is-failure" role="alert">The report document could not be written: a receipt or a bank statement may be damaged, or protected by a password. Replace it, and save the report again.</p>`
  }
  const draft = isDraftKept
    ? html`<p class="status">The draft, bank statements included, stays in this browser until New report.</p>`
    : html``
  const redaction =
    report.documentsOf(Kind.bankStatement).length > 0
      ? html`<p class="status reminder">Redact the bank statements in the report document before you submit it.</p>`
      : html``
  return html`<p class="status">The report document was handed to the browser: ${outcome.fileName}.</p>${redaction}${draft}`
}

/**
 * Step 4: the report as it will be written, each document's name opening it in a new tab, a heavy
 * document's size with what can be done of it, then its findings, the size of the report document,
 * and Save the report.
 */
export function reviewStep(
  saveReport: SaveReport,
  weighReport: WeighReport,
  isDraftKept: () => boolean,
  links: DocumentLinks,
): Step {
  let outcome: Outcome | undefined
  let weighing: Weighing | undefined
  /** Where the step shows, for when the sizes are known: the wizard renders it anew on a refresh. */
  let shown: { readonly panel: HTMLElement; readonly context: Context } | undefined

  /** Shows what is known of the sizes once worked out, if the step still shows and the report is the same. */
  function weigh(report: Report): void {
    const started: Weighing = { report }
    weighing = started
    void weighReport(report)
      .catch(() => ({ reportDocumentSize: undefined, weights: new Map() }))
      .then((weights) => {
        started.weights = weights
        if (weighing === started && shown?.panel.isConnected) {
          const { panel, context } = shown
          keepingFocus(panel, () => step.render(panel, context))
        }
      })
  }

  const step: Step = {
    title: 'Review',

    render(panel: HTMLElement, context: Context): void {
      shown = { panel, context }
      const report = context.report
      const findings = findingsOf(report)
      if (findings.length > 0) {
        const items = findings.map((finding) => html`<li>${finding.wording}</li>`)
        panel.innerHTML = html`<h2>Review</h2><ul class="findings">${items}</ul>`.text
        return
      }
      if (weighing?.report !== report) {
        weigh(report)
      }
      const weights = weighing?.weights
      const layout = layoutOf(report)
      const linkOf = linksAnew(links)
      panel.innerHTML = html`<h2>Review</h2>
        ${coverOf(layout, linkOf, report.isBusinessTravel)}
        ${sectionsOf(layout, linkOf, sizesOf(report, weights))}
        ${reportSizeOf(weights)}
        <button class="primary save" data-action="save">Save the report</button>
        ${statusOf(outcome, report, isDraftKept())}`.text
      const changeOn = (action: string, changed: (document: Document) => Report) => {
        for (const button of panel.querySelectorAll<HTMLButtonElement>(
          `[data-action="${action}"]`,
        )) {
          button.addEventListener('click', () => {
            const document = report.documents[Number(button.dataset.document)]
            if (document !== undefined) {
              context.change(changed(document))
              context.refresh()
            }
          })
        }
      }
      changeOn('reduce', (document) => report.afterReducing(document))
      changeOn('restore', (document) => report.afterRestoring(document))
      panel.querySelector('[data-action="save"]')?.addEventListener('click', () => {
        saveReport(report)
          .then((fileName) => {
            outcome = { report, fileName }
          })
          .catch(() => {
            outcome = { report, isFailed: true }
          })
          .finally(() => context.refresh())
      })
    },

    canContinue(): boolean {
      return false
    },
  }
  return step
}
