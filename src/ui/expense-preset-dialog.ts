import { Amount } from '../domain/amount.ts'
import { CalendarDate } from '../domain/calendar-date.ts'
import { CalendarMonth } from '../domain/calendar-month.ts'
import { Currency } from '../domain/currency.ts'
import type { Expense } from '../domain/expense.ts'
import type {
  ExpensePreset,
  ForeignValue,
  PresetParameter,
  PresetValues,
} from '../domain/expense-preset.ts'
import { expenseWording, fieldRules, notAfterTodayRule } from '../domain/findings.ts'
import type { Report } from '../domain/report.ts'
import { textOrAbsent } from '../domain/text.ts'
import { currencies, currencyNameOf, fieldName, latestDate, requiredMark } from './field.ts'
import { html, type Markup } from './html.ts'

/** What the button on the Expenses step and the heading of the dialog call it. */
export const addFromPreset = 'Add from a preset'

/** The name of the field of a parameter; of the fields of a foreign amount, next to it. */
const fieldOf = (parameter: PresetParameter) => `parameter-${parameter.id}`
const currencyFieldOf = (parameter: PresetParameter) => `${fieldOf(parameter)}-currency`
const foreignAmountFieldOf = (parameter: PresetParameter) => `${fieldOf(parameter)}-foreign-amount`

/** Add, by the number of expenses ticked. */
function addWording(count: number): string {
  if (count === 0) return 'Add expenses'
  return count === 1 ? 'Add 1 expense' : `Add ${count} expenses`
}

function nameOf(parameter: PresetParameter): Markup {
  return html`<span class="field-name">${parameter.label}${requiredMark(!parameter.isOptional)}</span>`
}

/** Paid in another currency, ticked or not; its currency and foreign amount when ticked. */
function foreignFieldOf(parameter: PresetParameter): Markup {
  return html`<label class="field checkbox">
      <input type="checkbox" name="${fieldOf(parameter)}" />
      <span class="field-name">${parameter.label}</span>
    </label>
    <div class="dates" data-foreign-of="${fieldOf(parameter)}" hidden>
      <label class="field">
        ${fieldName('foreignAmount', false)}
        <input name="${foreignAmountFieldOf(parameter)}" type="text" inputmode="decimal" />
        <span class="rule" data-rule-of="${foreignAmountFieldOf(parameter)}">${fieldRules.foreignAmount}</span>
      </label>
      <label class="field">
        ${fieldName('currency')}
        <input name="${currencyFieldOf(parameter)}" type="text" list="currencies" maxlength="3" autocomplete="off" />
        <span class="currency-name" data-currency-name></span>
        <span class="rule" data-rule-of="${currencyFieldOf(parameter)}">${fieldRules.currency}</span>
      </label>
      ${currencies}
    </div>`
}

/** The field of a preset parameter, by its type. */
function parameterField(parameter: PresetParameter, today: CalendarDate): Markup {
  const name = fieldOf(parameter)
  switch (parameter.type) {
    case 'text':
      return html`<label class="field">${nameOf(parameter)}<input name="${name}" type="text" autocomplete="off" /></label>`
    case 'date':
      return parameter.isNotAfterToday
        ? html`<label class="field">
            ${nameOf(parameter)}
            <input name="${name}" type="date" max="${today.toString()}" />
            <span class="rule" data-rule-of="${name}">${notAfterTodayRule}</span>
          </label>`
        : html`<label class="field">${nameOf(parameter)}<input name="${name}" type="date" max="${latestDate}" /></label>`
    case 'month':
      return html`<label class="field">${nameOf(parameter)}<select name="${name}" disabled><option value=""></option></select></label>`
    case 'amount':
      return html`<label class="field">
        ${nameOf(parameter)}
        <input name="${name}" type="text" inputmode="decimal" />
        <span class="rule" data-rule-of="${name}">${fieldRules.claimedAmount}</span>
      </label>`
    case 'foreignAmount':
      return foreignFieldOf(parameter)
  }
}

/** What the fields of the dialog hold: the values given, and what stops the expenses being added. */
interface ReadParameters {
  readonly values: PresetValues
  /** The fields holding a value that breaks their rule. */
  readonly broken: readonly string[]
  /** Whether a currency ticked is still to be given. */
  readonly lacksCurrency: boolean
}

/** Reads the fields of the parameters of a preset. */
function readParameters(
  dialog: HTMLElement,
  preset: ExpensePreset,
  today: CalendarDate,
): ReadParameters {
  const broken: string[] = []
  const typedIn = (name: string) =>
    dialog.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value ?? ''
  /** The value of a field that follows its rule; a field that does not is said to be broken. */
  const read = <Value>(name: string, parse: (text: string) => Value | undefined) => {
    const typed = typedIn(name)
    const value = parse(typed)
    if (value === undefined && typed.trim() !== '') broken.push(name)
    return value
  }
  const texts = new Map<string, string>()
  const dates = new Map<string, CalendarDate>()
  const months = new Map<string, CalendarMonth>()
  const amounts = new Map<string, Amount>()
  const foreignAmounts = new Map<string, ForeignValue>()
  const keep = <Value>(into: Map<string, Value>, id: string, value: Value | undefined) => {
    if (value !== undefined) into.set(id, value)
  }
  let lacksCurrency = false
  for (const parameter of preset.parameters) {
    const name = fieldOf(parameter)
    switch (parameter.type) {
      case 'text':
        keep(texts, parameter.id, textOrAbsent(typedIn(name)))
        break
      case 'date': {
        const date = read(name, CalendarDate.parse)
        if (parameter.isNotAfterToday && date !== undefined && today.isBefore(date)) {
          broken.push(name)
        } else {
          keep(dates, parameter.id, date)
        }
        break
      }
      case 'month':
        keep(months, parameter.id, read(name, CalendarMonth.parse))
        break
      case 'amount':
        keep(amounts, parameter.id, read(name, Amount.parse))
        break
      case 'foreignAmount': {
        const box = dialog.querySelector<HTMLInputElement>(`[name="${name}"]`)
        if (box?.checked === true) {
          const amount = read(foreignAmountFieldOf(parameter), Amount.parse)
          const currency = read(currencyFieldOf(parameter), Currency.parse)
          if (currency === undefined) lacksCurrency = true
          else foreignAmounts.set(parameter.id, { currency, amount })
        }
        break
      }
    }
  }
  return { values: { texts, dates, months, amounts, foreignAmounts }, broken, lacksCurrency }
}

/** The list of a month parameter, the month chosen kept while the list still holds it. */
function offerMonths(
  dialog: HTMLElement,
  preset: ExpensePreset,
  values: PresetValues,
  today: CalendarDate,
): void {
  for (const parameter of preset.parameters) {
    const select = dialog.querySelector<HTMLSelectElement>(`select[name="${fieldOf(parameter)}"]`)
    if (select !== null) {
      const months = preset.monthsOffered(parameter, values, today)
      const offered = months.join(' ')
      if (select.dataset.offered !== offered) {
        const chosen = select.value
        select.dataset.offered = offered
        select.innerHTML = html`<option value=""></option>${months.map(
          (month) => html`<option value="${month.toString()}">${month.inFull}</option>`,
        )}`.text
        select.value = months.some((month) => month.toString() === chosen) ? chosen : ''
        select.disabled = months.length === 0
      }
    }
  }
}

/** The fields of a foreign amount, shown when ticked; the name of its currency, under its code. */
function showForeignFields(dialog: HTMLElement, preset: ExpensePreset): void {
  for (const parameter of preset.parameters) {
    if (parameter.type === 'foreignAmount') {
      const name = fieldOf(parameter)
      const fields = dialog.querySelector<HTMLElement>(`[data-foreign-of="${name}"]`)
      const box = dialog.querySelector<HTMLInputElement>(`[name="${name}"]`)
      const currency = dialog.querySelector<HTMLInputElement>(
        `[name="${currencyFieldOf(parameter)}"]`,
      )
      if (fields !== null) {
        fields.hidden = box?.checked !== true
        const currencyName = fields.querySelector('[data-currency-name]')
        if (currencyName !== null) {
          currencyName.textContent = currencyNameOf(Currency.parse(currency?.value ?? ''))
        }
      }
    }
  }
}

/** The expenses a preset would add, in order, each with a tick box. */
function expensesOf(expenses: readonly Expense[], unticked: ReadonlySet<number>): Markup {
  const rows = expenses.map(
    (expense, index) => html`<tr>
      <td><input type="checkbox" data-tick="${index}" ${unticked.has(index) ? '' : html`checked`} aria-label="${expenseWording(expense)}" /></td>
      <td class="date">${expense.date?.toString() ?? ''}</td>
      <td class="description">${expense.description ?? ''}</td>
      <td>${expense.foreignAmountText || (expense.currency?.code ?? '')}</td>
      <td>${expense.claimedAmount?.toString() ?? ''}</td>
    </tr>`,
  )
  return html`<table class="expenses">
    <thead><tr>
      <th></th><th class="date">Date</th><th>Description</th><th>Foreign amount</th><th>Claimed (CAD)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

/**
 * Asks the Claimant which preset to add and its preset parameters, in a dialog over the step that
 * holds everything else until it is answered; under them, once every required parameter is given
 * and none breaks its rule, the expenses the preset would add, each with a tick box. Add is offered
 * once one is ticked, and gives those ticked. Cancel, or Escape, gives none. What is typed is kept
 * only then.
 */
export function expensesFromPreset(
  page: Document,
  presets: readonly ExpensePreset[],
  report: Report,
): Promise<readonly Expense[]> {
  const [first] = presets
  if (first === undefined) return Promise.resolve([])
  const today = CalendarDate.today()
  const dialog = page.createElement('dialog')
  dialog.className = 'expense-preset'
  dialog.setAttribute('aria-labelledby', 'expense-preset-heading')
  dialog.innerHTML = html`<h2 id="expense-preset-heading">${addFromPreset}</h2>
    <label class="field">
      ${fieldName('preset')}
      <select name="preset" autofocus>${presets.map(
        (preset, index) => html`<option value="${index}">${preset.name}</option>`,
      )}</select>
    </label>
    <div data-parameters></div>
    <div data-expenses></div>
    <div class="actions">
      <button type="button" data-answer="cancel">Cancel</button>
      <button type="button" class="primary" data-answer="add" disabled></button>
    </div>`.text
  page.body.append(dialog)
  const presetField = dialog.querySelector<HTMLSelectElement>('[name="preset"]')
  const parameters = dialog.querySelector<HTMLElement>('[data-parameters]')
  const proposed = dialog.querySelector<HTMLElement>('[data-expenses]')
  const add = dialog.querySelector<HTMLButtonElement>('[data-answer="add"]')
  let preset = first
  /** The places, among the expenses, of those unticked: kept while the parameters change. */
  const unticked = new Set<number>()
  let expenses: readonly Expense[] = []
  const ticked = () => expenses.filter((_, index) => !unticked.has(index))
  const offerAdd = () => {
    if (add !== null) {
      add.textContent = addWording(ticked().length)
      add.disabled = ticked().length === 0
    }
  }
  const update = () => {
    showForeignFields(dialog, preset)
    const { values, broken, lacksCurrency } = readParameters(dialog, preset, today)
    offerMonths(dialog, preset, values, today)
    for (const rule of dialog.querySelectorAll<HTMLElement>('[data-rule-of]')) {
      rule.classList.toggle('is-broken', broken.includes(rule.dataset.ruleOf ?? ''))
    }
    expenses =
      broken.length > 0 || lacksCurrency ? [] : (preset.expensesFor(values, report, today) ?? [])
    if (proposed !== null) {
      proposed.innerHTML = expenses.length > 0 ? expensesOf(expenses, unticked).text : ''
    }
    offerAdd()
  }
  const showPreset = () => {
    if (parameters !== null) {
      parameters.innerHTML =
        html`${preset.parameters.map((parameter) => parameterField(parameter, today))}`.text
    }
    unticked.clear()
    update()
  }
  showPreset()
  parameters?.addEventListener('input', update)
  presetField?.addEventListener('input', () => {
    preset = presets[Number(presetField.value)] ?? first
    showPreset()
  })
  proposed?.addEventListener('input', (event) => {
    const box = event.target as HTMLInputElement
    const place = Number(box.dataset.tick)
    if (box.checked) unticked.delete(place)
    else unticked.add(place)
    offerAdd()
  })
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      const added = dialog.returnValue === 'add' ? ticked() : []
      dialog.remove()
      resolve(added)
    })
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-answer]')) {
      button.addEventListener('click', () => dialog.close(button.dataset.answer))
    }
    dialog.showModal()
  })
}
