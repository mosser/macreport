import { fieldNames, findingsOf } from '../domain/findings.ts'
import { type ExpenseRow, type Layout, layoutOf, type Section } from '../domain/layout.ts'
import { Meal } from '../domain/meal.ts'
import type { PerDiem } from '../domain/per-diem.ts'
import type { Report } from '../domain/report.ts'
import { type DocumentLinks, type LinkOf, linksAnew, namesOf } from './document-link.ts'
import { html, type Markup } from './html.ts'
import type { Context, Step } from './step.ts'

/** Writes the report document of a report without findings and hands it to the browser; gives its file name. */
export type SaveReport = (report: Report) => Promise<string>

/**
 * The cover: its fields, then each expense on two lines, the second its documents; the per diems,
 * under their own heading; then the total of the report.
 */
function coverOf(layout: Layout, linkOf: LinkOf): Markup {
  const fields = layout.coverFields.map(
    (field) => html`<tr><th scope="row">${field.name}</th><td>${field.value}</td></tr>`,
  )
  const rows = layout.expenses
    .filter((row) => row.perDiem === undefined)
    .map((row) => {
      const documents = row.supportingDocuments.map((supporting) => supporting.document)
      return html`<tr class="expense">
        <td>${row.number}</td><td>${row.date}</td><td class="description">${row.description}</td>
        <td>${row.foreignAmount}</td><td>${row.claimedAmount}</td>
      </tr>
      <tr class="supporting"><td></td><td></td><td colspan="3">${namesOf(documents, linkOf)}</td></tr>`
    })
  return html`<table class="cover-fields">${fields}</table>
    <table class="expenses">
      <thead><tr>
        <th>#</th><th>Date</th><th>Description</th><th>Foreign amount</th><th>Claimed (CAD)</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${perDiemsOf(layout.expenses)}
    <table class="report-total">
      <tr class="total"><th scope="row">Total</th><td>${layout.total.map((line) => html`<div>${line}</div>`)}</td></tr>
    </table>`
}

/**
 * The per diems, one row per day with a meal claimed: its numbers on the cover, its date, domestic
 * or international, each meal claimed with its rate or not claimed with its reason, and its total,
 * one amount per currency.
 */
function perDiemsOf(rows: readonly ExpenseRow[]): Markup {
  const numbers = new Map<PerDiem, number[]>()
  for (const { perDiem, number } of rows) {
    if (perDiem !== undefined) numbers.set(perDiem, [...(numbers.get(perDiem) ?? []), number])
  }
  if (numbers.size === 0) {
    return html``
  }
  const lines = [...numbers].map(([perDiem, numbered]) => {
    const meals = Meal.all.map((meal) => {
      if (perDiem.isClaiming(meal)) {
        return html`<td>${perDiem.rateTextOf(meal)}</td>`
      }
      const reason = perDiem.reasonFor(meal)
      return html`<td class="not-claimed">Not claimed${reason === undefined ? '' : html`<div>${reason}</div>`}</td>`
    })
    const scopes = [
      ...(perDiem.mealsClaimedThat(false).length > 0 ? [fieldNames.domestic] : []),
      ...(perDiem.mealsClaimedThat(true).length > 0 ? [fieldNames.international] : []),
    ]
    return html`<tr>
      <td>${numbered.join(', ')}</td><td>${perDiem.date.toString()}</td>
      <td>${scopes.join(', ')}</td>
      ${meals}<td>${perDiem.amountTexts.map((amount) => html`<div>${amount}</div>`)}</td>
    </tr>`
  })
  return html`<h3>Per diems</h3>
    <table class="per-diems">
      <thead><tr>
        <th>#</th><th>Date</th><th></th>${Meal.all.map((meal) => html`<th>${meal.title}</th>`)}<th>Total</th>
      </tr></thead>
      <tbody>${lines}</tbody>
    </table>`
}

function sectionsOf(layout: Layout, linkOf: LinkOf): Markup[] {
  return layout.sections.map((section) => {
    const expenses = (cell: Markup) => (section.listsExpenses ? cell : '')
    const table = (documents: Section['documents']) => {
      const rows = documents.map((entry) => {
        const descriptions = entry.expenses.map(
          ({ description }) => html`<div>${description}</div>`,
        )
        const numbers = html`<td>${descriptions}</td>`
        return html`<tr><td>${entry.label}</td><td>${linkOf(entry.document)}</td>${expenses(numbers)}</tr>`
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
  return html`<p class="status">The report document was handed to the browser: ${outcome.fileName}.</p>${draft}`
}

/** Step 4: the report as it will be written, each document's name opening it in a new tab, then its findings, and Save the report. */
export function reviewStep(
  saveReport: SaveReport,
  isDraftKept: () => boolean,
  links: DocumentLinks,
): Step {
  let outcome: Outcome | undefined
  return {
    title: 'Review',

    render(panel: HTMLElement, context: Context): void {
      const report = context.report
      const findings = findingsOf(report)
      if (findings.length > 0) {
        const items = findings.map((finding) => html`<li>${finding.wording}</li>`)
        panel.innerHTML = html`<h2>Review</h2><ul class="findings">${items}</ul>`.text
        return
      }
      const layout = layoutOf(report)
      const linkOf = linksAnew(links)
      panel.innerHTML = html`<h2>Review</h2>
        ${coverOf(layout, linkOf)}
        ${sectionsOf(layout, linkOf)}
        <button class="primary save" data-action="save">Save the report</button>
        ${statusOf(outcome, report, isDraftKept())}`.text
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
}
