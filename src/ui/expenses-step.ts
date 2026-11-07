import { Amount } from '../domain/amount.ts'
import { CalendarDate } from '../domain/calendar-date.ts'
import { Currency } from '../domain/currency.ts'
import type { Document } from '../domain/document.ts'
import { Expense, type ExpenseFields } from '../domain/expense.ts'
import {
  claimedAmountInAnotherCurrencyRule,
  expenseWording,
  type Field,
  findingsOfExpensesStep,
  isRequired,
  missingFieldsOf,
  requiredWording,
} from '../domain/findings.ts'
import { Kind } from '../domain/kind.ts'
import type { Report } from '../domain/report.ts'
import { textOrAbsent } from '../domain/text.ts'
import { confirmed } from './confirmation.ts'
import {
  type DocumentField,
  documentFieldOf,
  listenToDocumentFields,
  type ReadFile,
} from './document-field.ts'
import { type DocumentLinks, type LinkOf, linksAnew, namesOf } from './document-link.ts'
import { fieldName, fieldRule } from './field.ts'
import { html, type Markup } from './html.ts'
import { pen, trashCan } from './icons.ts'
import type { Context, Step } from './step.ts'

/** The expense whose fields are open: its rank in the order the expenses were added, and the report it is of. */
interface Opened {
  readonly session: number
  readonly index: number
}

/** A value typed in a field of an expense: what it keeps, and whether it breaks the rule. */
function typed(field: string, value: string): { changes: ExpenseFields; isBroken: boolean } {
  const isEmpty = value.trim() === ''
  switch (field) {
    case 'date': {
      const date = CalendarDate.parse(value)
      return { changes: { date }, isBroken: !isEmpty && date === undefined }
    }
    case 'claimedAmount':
    case 'foreignAmount': {
      const amount = Amount.parse(value)
      return { changes: { [field]: amount }, isBroken: !isEmpty && amount === undefined }
    }
    case 'currency': {
      const currency = Currency.parse(value)
      return { changes: { currency }, isBroken: !isEmpty && currency === undefined }
    }
    default:
      return { changes: { description: textOrAbsent(value) }, isBroken: false }
  }
}

/** The report, with the expense of a rank changed; the report as it is when there is none. */
function afterChanging(
  report: Report,
  index: number,
  change: (expense: Expense) => Expense,
): Report {
  const expense = report.expenses[index]
  return expense === undefined ? report : report.afterReplacing(expense, change(expense))
}

/**
 * The receipt and the bank statement of the expense of a rank: one each, added from a file or
 * chosen among those already in the report, and taken out of this expense only.
 */
function documentFieldsOf(index: number): readonly DocumentField[] {
  const expenseIn = (report: Report) => report.expenses[index] ?? new Expense()
  const fieldOf = (
    field: Field,
    kind: Kind,
    documentsOf: (expense: Expense) => readonly Document[],
    changes: (documents: readonly Document[]) => ExpenseFields,
  ): DocumentField => ({
    field,
    kind,
    holdsOneDocument: true,
    documentsIn: (report) => documentsOf(expenseIn(report)),
    afterAdding: (report, document) =>
      afterChanging(report, index, (expense) => expense.afterChanging(changes([document]))),
    afterRemoving: (report, document) =>
      afterChanging(report, index, (expense) => expense.afterRemoving(document)),
    choicesIn: (report) =>
      report
        .documentsOf(kind)
        .filter((document) => !expenseIn(report).documents.includes(document)),
  })
  return [
    fieldOf(
      'receipts',
      Kind.receipt,
      (expense) => expense.receipts,
      (receipts) => ({ receipts }),
    ),
    fieldOf(
      'bankStatements',
      Kind.bankStatement,
      (expense) => expense.bankStatements,
      (bankStatements) => ({ bankStatements }),
    ),
  ]
}

/** A field typed in, with its name, what follows it, its rule, and the value the expense keeps. */
function input(
  field: Field,
  value: string,
  attributes: Markup,
  expense: Expense,
  after: Markup = html``,
): Markup {
  return html`<label class="field">
    ${fieldName(field, isRequired(field, expense))}
    <input name="${field}" ${attributes} value="${value}" />
    ${after}
    ${fieldRule(field)}
  </label>`
}

/** The currencies offered as the Claimant types one, each by its code and its name. */
const currencies = html`<datalist id="currencies">${Currency.all.map(
  (currency) => html`<option value="${currency.code}">${currency.name}</option>`,
)}</datalist>`

/** The name of a currency, under its code; nothing until the code is one. */
function currencyNameOf(currency: Currency | undefined): string {
  return currency === undefined || currency.name === currency.code ? '' : currency.name
}

/** The fields of an expense, filled in, its receipt and bank statement, and Done. */
function formOf(
  report: Report,
  expense: Expense,
  fields: readonly DocumentField[],
  chosenAgain: ReadonlyMap<Field, Document>,
): Markup {
  const claimedAmountRule = expense.isPaidInAnotherCurrency
    ? html`<span class="rule" data-rule-of="claimedAmount">${claimedAmountInAnotherCurrencyRule}</span>`
    : fieldRule('claimedAmount')
  const foreign = expense.isPaidInAnotherCurrency
    ? html`<div class="dates">
        ${input('foreignAmount', expense.foreignAmount?.typed ?? '', html`type="text" inputmode="decimal"`, expense)}
        ${input('currency', expense.currency?.code ?? '', html`type="text" list="currencies" maxlength="3" autocomplete="off"`, expense, html`<span class="currency-name" data-currency-name>${currencyNameOf(expense.currency)}</span>`)}
        ${currencies}
      </div>`
    : ''
  return html`<h2>Expense</h2>
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
      ${fieldName('claimedAmount', isRequired('claimedAmount', expense))}
      <input name="claimedAmount" type="text" inputmode="decimal"
        value="${expense.claimedAmount?.typed ?? ''}" />
      ${claimedAmountRule}
    </label>
    <label class="field checkbox">
      <input type="checkbox" name="paidInAnotherCurrency" ${expense.isPaidInAnotherCurrency ? html`checked` : ''} />
      ${fieldName('paidInAnotherCurrency')}
    </label>
    ${foreign}
    ${fields.map((field) => documentFieldOf(field, report, chosenAgain.get(field.field)))}
    <button type="button" class="primary" data-action="done">Done</button>`
}

/**
 * The expenses, sorted by date, each with its fields, its documents, each a link that opens it in
 * a new tab, and what it still lacks,
 * Change, a pen, and Remove, a trash can; Add an expense above them.
 */
function listOf(report: Report, linkOf: LinkOf): Markup {
  const rows = report.expensesByDate.map((expense) => {
    const index = report.expenses.indexOf(expense)
    const names = namesOf(expense.documents, linkOf)
    const lacks = missingFieldsOf(expense).map((field) => html`<li>${requiredWording(field)}</li>`)
    return html`<tr class="expense">
        <td>${expense.date?.toString() ?? ''}</td>
        <td class="description">${expense.description ?? ''}</td>
        <td>${expense.foreignAmountText}</td>
        <td>${expense.claimedAmount?.toString() ?? ''}</td>
        <td class="expense-actions" rowspan="2">
          <button type="button" class="icon" data-change="${index}"
            aria-label="Change" title="Change">${pen}</button>
          <button type="button" class="icon remove" data-remove-expense="${index}"
            aria-label="Remove" title="Remove">${trashCan}</button>
        </td>
      </tr>
      <tr class="supporting"><td></td><td colspan="3">${names}
        ${lacks.length > 0 ? html`<ul class="lacks">${lacks}</ul>` : ''}</td></tr>`
  })
  const table =
    rows.length > 0
      ? html`<table class="expenses expense-list">
          <thead><tr>
            <th>Date</th><th>Description</th><th>Foreign amount</th><th>Claimed (CAD)</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : ''
  return html`<h2>Expenses</h2>
    <button type="button" class="add-expense" data-action="add-expense">Add an expense</button>
    ${table}`
}

/** What Remove asks of an expense: the expense, and each document that leaves with it. */
function removalOf(report: Report, expense: Expense) {
  const leaving = report
    .documentsLeavingWith(expense)
    .map((document) => `${document.kind.name} ${document.name} leaves the report with it.`)
  return {
    question: 'Remove this expense?',
    details: [expenseWording(expense), ...leaving],
    action: 'Remove',
  }
}

/**
 * Step 2: the expenses, each changed or removed, and Add an expense; or the fields of the
 * expense added or changed, until Done.
 */
export function expensesStep(readFile: ReadFile, links: DocumentLinks): Step {
  let opened: Opened | undefined
  /** The document chosen again for a file added again, by its field, while the expense is open. */
  const chosenAgain = new Map<Field, Document>()

  const open = (context: Context, index: number | undefined) => {
    opened = index === undefined ? undefined : { session: context.session, index }
    chosenAgain.clear()
    context.refresh()
  }

  const renderForm = (panel: HTMLElement, context: Context, index: number, expense: Expense) => {
    const fields = documentFieldsOf(index)
    panel.innerHTML = formOf(context.report, expense, fields, chosenAgain).text
    for (const element of panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="file"]):not([type="checkbox"]):not([name="documentName"]), textarea',
    )) {
      element.addEventListener('input', () => {
        const { changes, isBroken } = typed(element.name, element.value)
        context.change(afterChanging(context.report, index, (each) => each.afterChanging(changes)))
        if (element.name === 'currency') {
          const name = panel.querySelector('[data-currency-name]')
          if (name !== null) name.textContent = currencyNameOf(changes.currency)
        }
        panel
          .querySelector(`[data-rule-of="${element.name}"]`)
          ?.classList.toggle('is-broken', isBroken)
        context.refreshActions()
      })
    }
    panel
      .querySelector<HTMLInputElement>('[name="paidInAnotherCurrency"]')
      ?.addEventListener('change', (event) => {
        const isPaidInAnotherCurrency = (event.target as HTMLInputElement).checked
        context.change(
          afterChanging(context.report, index, (each) =>
            each.afterChanging({ isPaidInAnotherCurrency }),
          ),
        )
        context.refresh()
      })
    panel
      .querySelector('[data-action="done"]')
      ?.addEventListener('click', () => open(context, undefined))
    listenToDocumentFields(panel, context, readFile, fields, (field, document) => {
      chosenAgain.set(field.field, document)
    })
  }

  const renderList = (panel: HTMLElement, context: Context) => {
    panel.innerHTML = listOf(context.report, linksAnew(links)).text
    panel.querySelector('[data-action="add-expense"]')?.addEventListener('click', () => {
      context.change(context.report.afterAdding(new Expense()))
      open(context, context.report.expenses.length - 1)
    })
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-change]')) {
      button.addEventListener('click', () => open(context, Number(button.dataset.change)))
    }
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-remove-expense]')) {
      button.addEventListener('click', async () => {
        const report = context.report
        const expense = report.expenses[Number(button.dataset.removeExpense)]
        if (expense === undefined) return
        const isConfirmed = await confirmed(panel.ownerDocument, removalOf(report, expense))
        if (isConfirmed && context.report.expenses.includes(expense)) {
          context.change(context.report.afterRemovingExpense(expense))
          context.refresh()
        }
      })
    }
  }

  return {
    title: 'Expenses',

    render(panel: HTMLElement, context: Context): void {
      const expense =
        opened?.session === context.session ? context.report.expenses[opened.index] : undefined
      if (opened !== undefined && expense !== undefined) {
        renderForm(panel, context, opened.index, expense)
      } else {
        opened = undefined
        renderList(panel, context)
      }
    },

    canContinue(report: Report): boolean {
      return findingsOfExpensesStep(report).length === 0
    },

    offersContinue(): boolean {
      return opened === undefined
    },

    leave(): void {
      opened = undefined
      chosenAgain.clear()
    },
  }
}
