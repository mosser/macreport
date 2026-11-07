import { findingsOf } from '../domain/findings.ts'
import { type Layout, layoutOf } from '../domain/layout.ts'
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
      <td>${row.foreignAmount}</td><td>${row.claimedAmount}</td><td>${row.supportingDocuments.join(', ')}</td>
    </tr>`,
  )
  return html`<table class="cover-fields">${fields}</table>
    <table class="expenses">
      <thead><tr>
        <th>#</th><th>Date</th><th>Description</th><th>Foreign amount</th>
        <th>Claimed (CAD)</th><th>Supporting documents</th>
      </tr></thead>
      <tbody>${rows}<tr class="total"><td></td><td></td><td>Total</td><td></td><td>${layout.total}</td><td></td></tr></tbody>
    </table>`
}

function sectionsOf(layout: Layout): Markup[] {
  return layout.sections.map(
    (section) => html`<h3>${section.title}</h3>
      <table class="section">
        <thead><tr><th>Label</th><th>File</th><th>Expenses</th></tr></thead>
        <tbody>${section.documents.map(
          (entry) =>
            html`<tr><td>${entry.label}</td><td>${entry.document.fileName}</td><td>${entry.expenseNumbers.join(', ')}</td></tr>`,
        )}</tbody>
      </table>`,
  )
}

/** Step 3: the report as it will be written, then its findings, and Save the report. */
export function reviewStep(saveReport: SaveReport): Step {
  let savedAs: string | undefined
  return {
    title: 'Review',

    render(panel: HTMLElement, context: Context): void {
      const findings = findingsOf(context.report)
      if (findings.length > 0) {
        savedAs = undefined
        panel.innerHTML = html`<h2>Review</h2>
          <ul class="findings">${findings.map((finding) => html`<li>${finding.wording}</li>`)}</ul>`.text
        return
      }
      const layout = layoutOf(context.report)
      const status =
        savedAs === undefined
          ? ''
          : html`<p class="status">The report document was handed to the browser: ${savedAs}.</p>`
      panel.innerHTML = html`<h2>Review</h2>
        ${coverOf(layout)}
        ${sectionsOf(layout)}
        <button class="primary" data-action="save">Save the report</button>
        ${status}`.text
      panel.querySelector('[data-action="save"]')?.addEventListener('click', async () => {
        savedAs = await saveReport(context.report)
        context.refresh()
      })
    },

    canContinue(): boolean {
      return false
    },
  }
}
