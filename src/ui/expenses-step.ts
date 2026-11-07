import { Amount } from '../domain/amount.ts'
import { CalendarDate } from '../domain/calendar-date.ts'
import type { Document } from '../domain/document.ts'
import { Expense, type ExpenseFields } from '../domain/expense.ts'
import { findingsOfExpensesStep } from '../domain/findings.ts'
import { Kind } from '../domain/kind.ts'
import type { Report } from '../domain/report.ts'
import { textOrAbsent } from '../domain/text.ts'
import { fieldName, fieldRule } from './field.ts'
import { html, type Markup } from './html.ts'
import type { Context, Step } from './step.ts'

/** Reads a file the Claimant adds into a document of a kind. */
export type ReadFile = (file: File, kind: Kind) => Promise<Document>

const accepted = 'application/pdf,image/jpeg,image/png'

/** The expense of the report, or a new one when none is claimed yet. */
function expenseOf(report: Report): Expense {
  return report.expenses[0] ?? new Expense()
}

/** The report, with its expense changed, or claiming it when it did not yet. */
function afterChanging(report: Report, changes: ExpenseFields): Report {
  const expense = report.expenses[0]
  return expense === undefined
    ? report.afterAdding(new Expense(changes))
    : report.afterReplacing(expense, expense.afterChanging(changes))
}

/** A value typed in a field of the expense: what it keeps, and whether it breaks the rule. */
function typed(field: string, value: string): { changes: ExpenseFields; isBroken: boolean } {
  if (field === 'date') {
    const date = CalendarDate.parse(value)
    return { changes: { date }, isBroken: value !== '' && date === undefined }
  }
  if (field === 'claimedAmount') {
    const claimedAmount = Amount.parse(value)
    return { changes: { claimedAmount }, isBroken: value.trim() !== '' && !claimedAmount }
  }
  return { changes: { description: textOrAbsent(value) }, isBroken: false }
}

function fileField(field: 'receipts' | 'bankStatements', documents: readonly Document[]): Markup {
  const added = documents.map((document) => html`<span class="added">${document.fileName}</span>`)
  return html`<label class="field">
    ${fieldName(field)}
    <input name="${field}" type="file" accept="${accepted}" />
    ${added}
    ${fieldRule(field)}
  </label>`
}

/** Step 2: the expense, with its receipt and its bank statement. */
export function expensesStep(readFile: ReadFile): Step {
  return {
    title: 'Expenses',

    render(panel: HTMLElement, context: Context): void {
      const expense = expenseOf(context.report)
      panel.innerHTML = html`<h2>Expense</h2>
        <label class="field">
          ${fieldName('date')}
          <input name="date" type="date" value="${expense.date?.toString() ?? ''}" />
          ${fieldRule('date')}
        </label>
        <label class="field">
          ${fieldName('description')}
          <textarea name="description">${expense.description ?? ''}</textarea>
          ${fieldRule('description')}
        </label>
        <label class="field">
          ${fieldName('claimedAmount')}
          <input name="claimedAmount" type="text" inputmode="decimal"
            value="${expense.claimedAmount ? (expense.claimedAmount.cents / 100).toFixed(2) : ''}" />
          ${fieldRule('claimedAmount')}
        </label>
        ${fileField('receipts', expense.receipts)}
        ${fileField('bankStatements', expense.bankStatements)}`.text

      for (const element of panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="file"]), textarea',
      )) {
        element.addEventListener('input', () => {
          const { changes, isBroken } = typed(element.name, element.value)
          context.change(afterChanging(context.report, changes))
          panel
            .querySelector(`[data-rule-of="${element.name}"]`)
            ?.classList.toggle('is-broken', isBroken)
          context.refreshActions()
        })
      }
      for (const element of panel.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
        element.addEventListener('change', async () => {
          const file = element.files?.[0]
          if (file === undefined) return
          const kind = element.name === 'receipts' ? Kind.receipt : Kind.bankStatement
          const document = await readFile(file, kind)
          const changes =
            element.name === 'receipts' ? { receipts: [document] } : { bankStatements: [document] }
          context.change(afterChanging(context.report, changes))
          context.refresh()
        })
      }
    },

    canContinue(report: Report): boolean {
      return findingsOfExpensesStep(report).length === 0
    },
  }
}
