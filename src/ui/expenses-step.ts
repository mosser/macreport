import { Amount } from '../domain/amount.ts'
import { CalendarDate } from '../domain/calendar-date.ts'
import type { Document } from '../domain/document.ts'
import { Expense, type ExpenseFields } from '../domain/expense.ts'
import { findingsOfExpensesStep } from '../domain/findings.ts'
import { Kind } from '../domain/kind.ts'
import type { Report } from '../domain/report.ts'
import { textOrAbsent } from '../domain/text.ts'
import {
  type DocumentField,
  documentFieldOf,
  listenToDocumentFields,
  type ReadFile,
} from './document-field.ts'
import { fieldName, fieldRule } from './field.ts'
import { html } from './html.ts'
import type { Context, Step } from './step.ts'

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

/** The receipt of the expense: one, until it is removed. */
const receipts: DocumentField = {
  field: 'receipts',
  kind: Kind.receipt,
  holdsOneDocument: true,
  documentsIn: (report: Report) => expenseOf(report).receipts,
  afterAdding: (report: Report, document: Document) =>
    afterChanging(report, { receipts: [document] }),
}

/** The bank statement of the expense: one, until it is removed. */
const bankStatements: DocumentField = {
  field: 'bankStatements',
  kind: Kind.bankStatement,
  holdsOneDocument: true,
  documentsIn: (report: Report) => expenseOf(report).bankStatements,
  afterAdding: (report: Report, document: Document) =>
    afterChanging(report, { bankStatements: [document] }),
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
        ${documentFieldOf(receipts, context.report)}
        ${documentFieldOf(bankStatements, context.report)}`.text

      for (const element of panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="file"]):not([name="documentName"]), textarea',
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
      listenToDocumentFields(panel, context, readFile, [receipts, bankStatements])
    },

    canContinue(report: Report): boolean {
      return findingsOfExpensesStep(report).length === 0
    },
  }
}
