import { Amount } from '../domain/amount.ts'
import { CalendarDate } from '../domain/calendar-date.ts'
import { Currency } from '../domain/currency.ts'
import type { Document } from '../domain/document.ts'
import { Expense, type ExpenseFields } from '../domain/expense.ts'
import {
  claimedAmountInAnotherCurrencyRule,
  expenseWording,
  type Field,
  fieldNames,
  findingsOfExpensesStep,
  isRequired,
  lacksOf,
} from '../domain/findings.ts'
import { Kind } from '../domain/kind.ts'
import { mealsNotClaimedOf, perDiemDescriptionsOf, totalOf } from '../domain/layout.ts'
import { Meal } from '../domain/meal.ts'
import type { PerDiem } from '../domain/per-diem.ts'
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

/**
 * The expense whose fields are open: its rank in the order the expenses were added, the report it
 * is of, and the expense as it was before they opened, which Discard puts back; none for an
 * expense just added, which Discard takes out.
 */
interface Opened {
  readonly session: number
  readonly index: number
  readonly before: Expense | undefined
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

/**
 * The fields of an expense, filled in, a value typed that breaks its rule as it was typed, its
 * receipt and bank statement, and Done.
 */
function formOf(
  report: Report,
  expense: Expense,
  fields: readonly DocumentField[],
  chosenAgain: ReadonlyMap<Field, Document>,
  broken: ReadonlyMap<Field, string>,
): Markup {
  const shown = (field: Field, kept: string | undefined) => broken.get(field) ?? kept ?? ''
  const currencyName = html`<span class="currency-name" data-currency-name>${currencyNameOf(expense.currency)}</span>`
  const claimedAmountRule = expense.isPaidInAnotherCurrency
    ? html`<span class="rule" data-rule-of="claimedAmount">${claimedAmountInAnotherCurrencyRule}</span>`
    : fieldRule('claimedAmount')
  const foreign = expense.isPaidInAnotherCurrency
    ? html`<div class="dates">
        ${input('foreignAmount', shown('foreignAmount', expense.foreignAmount?.typed), html`type="text" inputmode="decimal"`, expense)}
        ${input('currency', shown('currency', expense.currency?.code), html`type="text" list="currencies" maxlength="3" autocomplete="off"`, expense, currencyName)}
        ${currencies}
      </div>`
    : ''
  return html`<h2>Expense</h2>
    <label class="field">
      ${fieldName('date')}
      <input name="date" type="date" value="${shown('date', expense.date?.toString())}" />
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
        value="${shown('claimedAmount', expense.claimedAmount?.typed)}" />
      ${claimedAmountRule}
    </label>
    <label class="field checkbox">
      <input type="checkbox" name="paidInAnotherCurrency" ${expense.isPaidInAnotherCurrency ? html`checked` : ''} />
      ${fieldName('paidInAnotherCurrency')}
    </label>
    ${foreign}
    ${fields.map((field) => documentFieldOf(field, report, chosenAgain.get(field.field)))}
    <div class="expense-buttons">
      <button type="button" class="primary" data-action="done" data-held>Done</button>
      <button type="button" data-action="discard" data-held-while-adding>Discard</button>
    </div>`
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
    const lacks = lacksOf(report, expense).map((lack) => html`<li>${lack}</li>`)
    const lackList = lacks.length > 0 ? html`<ul class="lacks">${lacks}</ul>` : ''
    return html`<tr class="expense">
        <td>${expense.date?.toString() ?? ''}</td>
        <td class="description">${expense.description ?? ''}</td>
        <td>${expense.foreignAmountText}</td>
        <td>${expense.claimedAmount?.toString() ?? ''}</td>
        <td class="expense-actions" rowspan="2">
          <button type="button" class="icon" data-change="${index}"
            aria-label="Change" title="Change">${pen}</button>
          <button type="button" class="icon remove" data-remove-expense="${index}" data-held
            aria-label="Remove" title="Remove">${trashCan}</button>
        </td>
      </tr>
      <tr class="supporting"><td></td><td colspan="3">${names}${lackList}</td></tr>`
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
  const managePerDiems = report.asksForPerDiems
    ? html`<button type="button" class="add-expense" data-action="manage-per-diems">Manage per diems</button>`
    : ''
  return html`<h2>Expenses</h2>
    <div class="expense-buttons">
      <button type="button" class="add-expense" data-action="add-expense">Add an expense</button>
      ${managePerDiems}
    </div>
    ${perDiemsLineOf(report)}
    ${table}`
}

/**
 * The per diems, when a meal is claimed: on one line, the number of days with a meal claimed and
 * their total, in Canadian dollars then in US dollars; then each of those days, by date: its meals
 * claimed, domestic then international, then its meals not claimed and their reasons. No amount
 * but the total.
 */
function perDiemsLineOf(report: Report): Markup {
  const claimed = report.claimedPerDiems
  if (claimed.length === 0) {
    return html``
  }
  const days = claimed.length === 1 ? '1 day' : `${claimed.length} days`
  const line = [days, ...totalOf([], claimed)].join(' · ')
  const rows = claimed.map(
    (perDiem) => html`<tr class="expense">
        <td>${perDiem.date.toString()}</td>
        <td class="description">${perDiemDescriptionsOf(perDiem).join('\n')}</td>
      </tr>
      <tr class="supporting"><td></td><td>${mealsNotClaimedOf(perDiem)}</td></tr>`,
  )
  return html`<p class="per-diems-line">Per diems: ${line}</p>
    <table class="expenses per-diem-list">
      <thead><tr><th>Date</th><th>Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
}

/**
 * The choice of a day between domestic and international for its three meals, or per meal: per
 * meal while it shows them per meal, domestic or international when every meal is.
 */
function scopeOf(
  perDiem: PerDiem,
  field: 'domestic' | 'international' | 'perMeal',
  isPerMeal: boolean,
): Markup {
  const day = perDiem.date.toString()
  const isChosenFor = {
    domestic: !isPerMeal && perDiem.isEveryMealDomestic,
    international: !isPerMeal && perDiem.isEveryMealInternational,
    perMeal: isPerMeal,
  }
  return html`<label class="checkbox">
    <input type="radio" name="scope-${day}" value="${field}" data-day="${day}" ${isChosenFor[field] ? html`checked` : ''} />
    ${fieldNames[field]}
  </label>`
}

/** The choice of one meal of a day between domestic and international. */
function mealScopeOf(perDiem: PerDiem, meal: Meal, field: 'domestic' | 'international'): Markup {
  const day = perDiem.date.toString()
  const isChosen = perDiem.isInternational(meal) === (field === 'international')
  return html`<label class="checkbox">
    <input type="radio" name="scope-${day}-${meal.name}" value="${field}" data-day="${day}"
      data-meal="${meal.name}" ${isChosen ? html`checked` : ''} aria-label="${meal.title}, ${day}: ${fieldNames[field]}" />
    ${fieldNames[field]}
  </label>`
}

/**
 * Whether a day shows domestic or international under each of its meals: once Per meal is chosen,
 * and whenever its meals differ.
 */
function showsPerMeal(perDiem: PerDiem, perMeal: ReadonlySet<string>): boolean {
  return (
    perMeal.has(perDiem.date.toString()) ||
    !(perDiem.isEveryMealDomestic || perDiem.isEveryMealInternational)
  )
}

/** A meal of a day, as the step knows it while the per diems are open: 2026-10-03 lunch. */
function reasonKeyOf(perDiem: PerDiem, meal: Meal): string {
  return `${perDiem.date} ${meal.name}`
}

/**
 * Whether a meal shows the field of its reason: a meal not claimed of a day with a meal claimed,
 * once its reason is given or asked for.
 */
function showsReason(perDiem: PerDiem, meal: Meal, askedFor: ReadonlySet<string>): boolean {
  return (
    !perDiem.isClaiming(meal) &&
    perDiem.hasMealClaimed &&
    (perDiem.reasonFor(meal) !== undefined || askedFor.has(reasonKeyOf(perDiem, meal)))
  )
}

/**
 * The reasons of the meals not claimed of a day, one under the other, their fields aligned, each
 * with a trash can that takes it out; then Add a reason for the others of a day with a meal claimed.
 */
function reasonsOf(perDiem: PerDiem, askedFor: ReadonlySet<string>): Markup {
  const day = perDiem.date.toString()
  const shown = Meal.all.filter((meal) => showsReason(perDiem, meal, askedFor))
  const fields = shown.map(
    (meal) => html`<label class="reason">
      <span>Reason for not claiming ${meal.name} (optional)</span>
      <input type="text" name="reason" data-day="${day}" data-meal="${meal.name}"
        value="${perDiem.reasonFor(meal) ?? ''}" aria-label="${fieldNames.reason}, ${meal.name}, ${day}" />
    </label>
    <button type="button" class="icon remove" data-remove-reason data-day="${day}" data-meal="${meal.name}"
      aria-label="Remove the reason for not claiming ${meal.name}, ${day}" title="Remove">${trashCan}</button>`,
  )
  const offered = perDiem.hasMealClaimed
    ? perDiem.mealsNotClaimed.filter((meal) => !shown.includes(meal))
    : []
  const actions = offered.map(
    (meal) => html`<button type="button" class="quiet" data-add-reason
      data-day="${day}" data-meal="${meal.name}">Add a reason for not claiming ${meal.name} (optional)</button>`,
  )
  const reasons = fields.length > 0 ? html`<div class="reasons">${fields}</div>` : html``
  const additions = actions.length > 0 ? html`<div class="add-reasons">${actions}</div>` : html``
  return html`${reasons}${additions}`
}

/**
 * A meal of a day, a toggle pressed when it is claimed; under it, when the day shows them per
 * meal, domestic or international.
 */
function mealOf(perDiem: PerDiem, meal: Meal, isPerMeal: boolean): Markup {
  const day = perDiem.date.toString()
  const scopes = isPerMeal
    ? html`<div class="meal-scope">${mealScopeOf(perDiem, meal, 'domestic')}${mealScopeOf(perDiem, meal, 'international')}</div>`
    : ''
  return html`<div class="meal">
    <label class="meal-toggle">
      <input type="checkbox" name="meal" data-day="${day}" data-meal="${meal.name}"
        ${perDiem.isClaiming(meal) ? html`checked` : ''} aria-label="${meal.title}, ${day}" />
      ${meal.title}
    </label>
    ${scopes}
  </div>`
}

/**
 * The per diems of the business travel, one card per day, under its day of the week and its date:
 * domestic, international or per meal, each meal claimed or not, domestic or international under
 * each meal per meal, then the reasons of its meals not claimed; All domestic and All
 * international above, Done under.
 */
function perDiemsFormOf(
  report: Report,
  askedFor: ReadonlySet<string>,
  perMeal: ReadonlySet<string>,
): Markup {
  const days = report.perDiemsByDay.map((perDiem) => {
    const isPerMeal = showsPerMeal(perDiem, perMeal)
    const scopes = (['domestic', 'international', 'perMeal'] as const).map((field) =>
      scopeOf(perDiem, field, isPerMeal),
    )
    return html`<section class="per-diem-day">
      <div class="per-diem-heading">
        <h3><span class="day-of-week">${perDiem.date.dayOfWeek}</span> ${perDiem.date.toString()}</h3>
        <div class="per-diem-scope">${scopes}</div>
      </div>
      <div class="meal-toggles">${Meal.all.map((meal) => mealOf(perDiem, meal, isPerMeal))}</div>
      ${reasonsOf(perDiem, askedFor)}
    </section>`
  })
  return html`<h2>Per diems</h2>
    <div class="expense-buttons">
      <button type="button" data-action="all-domestic">All domestic</button>
      <button type="button" data-action="all-international">All international</button>
    </div>
    <div class="per-diem-days">${days}</div>
    <button type="button" class="primary" data-action="done">Done</button>`
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
 * Step 2: the expenses, each changed or removed, Add an expense and Manage per diems; or the
 * fields of the expense added or changed, until Done, or Discard, which undoes every change made
 * since they opened; or the per diems, until Done.
 */
export function expensesStep(readFile: ReadFile, links: DocumentLinks): Step {
  let opened: Opened | undefined
  /** The report the per diems are open in, by its session; none while they are closed. */
  let perDiemsOpenIn: number | undefined
  /** The meals whose reason was asked for with Add a reason, while the per diems are open. */
  const reasonsAskedFor = new Set<string>()
  /** The days Per meal was chosen for, while the per diems are open. */
  const perMealShownFor = new Set<string>()
  const closePerDiems = () => {
    perDiemsOpenIn = undefined
    reasonsAskedFor.clear()
    perMealShownFor.clear()
  }
  /** The document chosen again for a file added again, by its field, while the expense is open. */
  const chosenAgain = new Map<Field, Document>()
  /**
   * A value typed that breaks its rule, by its field, while the expense is open: the expense does
   * not keep it, so the step holds the others until it follows its rule or is cleared.
   */
  const broken = new Map<Field, string>()

  const forget = () => {
    chosenAgain.clear()
    broken.clear()
  }

  const open = (context: Context, index: number | undefined, isAdded = false) => {
    const before = isAdded || index === undefined ? undefined : context.report.expenses[index]
    opened = index === undefined ? undefined : { session: context.session, index, before }
    forget()
    context.refresh()
  }

  const renderForm = (panel: HTMLElement, context: Context, index: number, expense: Expense) => {
    const fields = documentFieldsOf(index)
    panel.innerHTML = formOf(context.report, expense, fields, chosenAgain, broken).text
    for (const field of broken.keys()) {
      panel.querySelector(`[data-rule-of="${field}"]`)?.classList.add('is-broken')
    }
    for (const element of panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="file"]):not([type="checkbox"]):not([name="documentName"]), textarea',
    )) {
      element.addEventListener('input', () => {
        const { changes, isBroken } = typed(element.name, element.value)
        if (isBroken) broken.set(element.name as Field, element.value)
        else broken.delete(element.name as Field)
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
        if (!isPaidInAnotherCurrency) {
          broken.delete('foreignAmount')
          broken.delete('currency')
        }
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
    panel.querySelector('[data-action="discard"]')?.addEventListener('click', () => {
      const expense = opened === undefined ? undefined : context.report.expenses[opened.index]
      if (opened !== undefined && expense !== undefined) {
        context.change(context.report.afterPuttingBack(expense, opened.before))
      }
      open(context, undefined)
    })
    listenToDocumentFields(panel, context, readFile, fields, (field, document) => {
      chosenAgain.set(field.field, document)
    })
  }

  const renderPerDiems = (panel: HTMLElement, context: Context) => {
    panel.innerHTML = perDiemsFormOf(context.report, reasonsAskedFor, perMealShownFor).text
    const perDiemOf = (element: HTMLElement) => {
      const day = CalendarDate.parse(element.dataset.day ?? '')
      return day === undefined ? undefined : context.report.perDiemOn(day)
    }
    const changing = (element: HTMLElement, change: (perDiem: PerDiem) => PerDiem) => {
      const perDiem = perDiemOf(element)
      if (perDiem !== undefined) {
        context.change(context.report.afterChangingPerDiem(change(perDiem)))
      }
    }
    /**
     * Renders the step again, then focuses the control that stands where the one used was, or
     * the one given instead when it is gone, so that the keyboard goes on from there.
     */
    const refreshFocusing = (selector: string, instead?: string) => {
      context.refresh()
      const document = panel.ownerDocument
      const control =
        document.querySelector<HTMLElement>(selector) ??
        (instead === undefined ? null : document.querySelector<HTMLElement>(instead))
      control?.focus()
    }
    for (const radio of panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      radio.addEventListener('change', () => {
        const day = radio.dataset.day ?? ''
        const meal = Meal.named(radio.dataset.meal ?? '')
        const isInternational = radio.value === 'international'
        if (radio.value === 'perMeal') {
          perMealShownFor.add(day)
        } else if (meal === undefined) {
          perMealShownFor.delete(day)
          changing(radio, (perDiem) => perDiem.afterMakingEveryMeal(isInternational))
        } else {
          changing(radio, (perDiem) => perDiem.afterMaking(meal, isInternational))
        }
        refreshFocusing(
          `input[type="radio"][name="${radio.name}"][value="${radio.value}"]`,
          `input[type="radio"][name="scope-${day}"]:checked`,
        )
      })
    }
    for (const box of panel.querySelectorAll<HTMLInputElement>('input[name="meal"]')) {
      box.addEventListener('change', () => {
        const meal = Meal.named(box.dataset.meal ?? '')
        if (meal !== undefined) changing(box, (perDiem) => perDiem.afterClaiming(meal, box.checked))
        if (box.checked) reasonsAskedFor.delete(`${box.dataset.day} ${box.dataset.meal}`)
        refreshFocusing(
          `input[name="meal"][data-day="${box.dataset.day}"][data-meal="${box.dataset.meal}"]`,
        )
      })
    }
    for (const field of panel.querySelectorAll<HTMLInputElement>('input[name="reason"]')) {
      field.addEventListener('input', () => {
        const meal = Meal.named(field.dataset.meal ?? '')
        const reason = textOrAbsent(field.value)
        if (meal !== undefined)
          changing(field, (perDiem) => perDiem.afterGivingReason(meal, reason))
        context.refreshActions()
      })
    }
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-remove-reason]')) {
      button.addEventListener('click', () => {
        const meal = Meal.named(button.dataset.meal ?? '')
        if (meal !== undefined)
          changing(button, (perDiem) => perDiem.afterGivingReason(meal, undefined))
        reasonsAskedFor.delete(`${button.dataset.day} ${button.dataset.meal}`)
        refreshFocusing(
          `[data-add-reason][data-day="${button.dataset.day}"][data-meal="${button.dataset.meal}"]`,
        )
      })
    }
    for (const button of panel.querySelectorAll<HTMLButtonElement>('[data-add-reason]')) {
      button.addEventListener('click', () => {
        const { day, meal } = button.dataset
        reasonsAskedFor.add(`${day} ${meal}`)
        refreshFocusing(`input[name="reason"][data-day="${day}"][data-meal="${meal}"]`)
      })
    }
    for (const [action, isInternational] of [
      ['all-domestic', false],
      ['all-international', true],
    ] as const) {
      panel.querySelector(`[data-action="${action}"]`)?.addEventListener('click', () => {
        perMealShownFor.clear()
        context.change(
          context.report.afterChangingEveryPerDiem({
            internationalMeals: isInternational ? Meal.all : [],
          }),
        )
        refreshFocusing(`[data-action="${action}"]`)
      })
    }
    panel.querySelector('[data-action="done"]')?.addEventListener('click', () => {
      closePerDiems()
      context.refresh()
    })
  }

  const renderList = (panel: HTMLElement, context: Context) => {
    panel.innerHTML = listOf(context.report, linksAnew(links)).text
    panel.querySelector('[data-action="manage-per-diems"]')?.addEventListener('click', () => {
      perDiemsOpenIn = context.session
      context.refresh()
    })
    panel.querySelector('[data-action="add-expense"]')?.addEventListener('click', () => {
      context.change(context.report.afterAdding(new Expense()))
      open(context, context.report.expenses.length - 1, true)
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
        return
      }
      opened = undefined
      forget()
      if (perDiemsOpenIn === context.session && context.report.asksForPerDiems) {
        renderPerDiems(panel, context)
      } else {
        closePerDiems()
        renderList(panel, context)
      }
    },

    canContinue(report: Report): boolean {
      return findingsOfExpensesStep(report).length === 0
    },

    offersContinue(): boolean {
      return opened === undefined && perDiemsOpenIn === undefined
    },

    holdsSteps(): boolean {
      return broken.size > 0
    },

    leave(): void {
      opened = undefined
      closePerDiems()
      forget()
    },
  }
}
