import { findingsOf } from '../domain/findings.ts'
import { type Layout, layoutOf, type Section } from '../domain/layout.ts'
import type { Report } from '../domain/report.ts'
import { html, type Markup } from './html.ts'
import type { Context, Step } from './step.ts'

/** Writes the report document of a report without findings and hands it to the browser; gives its file name. */
export type SaveReport = (report: Report) => Promise<string>

function coverOf(layout: Layout): Markup {
  const fields = layout.coverFields.map(
    (field) => html`<tr><th scope="row">${field.name}</th><td>${field.value}</td></tr>`,
  )
  const rows = layout.expenses.map(
    (row) => html`<tr>
      <td>${row.number}</td><td>${row.date}</td><td>${row.description}</td>
      <td>${row.foreignAmount}</td><td>${row.claimedAmount}</td>
      <td>${row.supportingDocuments.map((document) => html`<div>${document.name}</div>`)}</td>
      <td><input type="checkbox" disabled aria-label="Entered, expense ${row.number}" /></td>
    </tr>`,
  )
  return html`<table class="cover-fields">${fields}</table>
    <table class="expenses">
      <thead><tr>
        <th>#</th><th>Date</th><th>Description</th><th>Foreign amount</th>
        <th>Claimed (CAD)</th><th>Supporting documents</th><th>Entered</th>
      </tr></thead>
      <tbody>${rows}<tr class="total"><td></td><td></td><td>Total</td><td></td><td>${layout.total}</td><td></td><td></td></tr></tbody>
    </table>`
}

function sectionsOf(layout: Layout): Markup[] {
  return layout.sections.map((section) => {
    const expenses = (cell: Markup) => (section.listsExpenses ? cell : '')
    const table = (documents: Section['documents']) => {
      const rows = documents.map(
        (entry) =>
          html`<tr><td>${entry.label}</td><td>${entry.document.name}</td>${expenses(html`<td>${entry.expenseNumbers.join(', ')}</td>`)}</tr>`,
      )
      return html`<table class="section">
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

/** Step 4: the report as it will be written, then its findings, and Save the report. */
export function reviewStep(saveReport: SaveReport, isDraftKept: () => boolean): Step {
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
      panel.innerHTML = html`<h2>Review</h2>
        ${coverOf(layout)}
        ${sectionsOf(layout)}
        <button class="primary" data-action="save">Save the report</button>
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
