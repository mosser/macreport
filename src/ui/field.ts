import { Currency } from '../domain/currency.ts'
import { type Field, fieldNames, fieldRules, isRequired } from '../domain/findings.ts'
import { html, type Markup } from './html.ts'

/**
 * The latest date a date field takes: a year of four digits, after which a browser moves on to the
 * next part of the date by itself, as it does after a month. Without it, a year may be longer.
 */
export const latestDate = '9999-12-31'

/** The asterisk next to the name of a required field; nothing next to another. */
export function requiredMark(isFieldRequired: boolean): Markup {
  return isFieldRequired ? html` <abbr class="required" title="required">*</abbr>` : html``
}

/** The name of a field, with an asterisk when it is required. */
export function fieldName(field: Field, isFieldRequired = isRequired(field)): Markup {
  return html`<span class="field-name" id="name-of-${field}">${fieldNames[field]}${requiredMark(isFieldRequired)}</span>`
}

/** The currencies offered as the Claimant types one, each by its code and its name. */
export const currencies = html`<datalist id="currencies">${Currency.all.map(
  (currency) => html`<option value="${currency.code}">${currency.name}</option>`,
)}</datalist>`

/** The name of a currency, under its code; nothing until the code is one. */
export function currencyNameOf(currency: Currency | undefined): string {
  return currency === undefined || currency.name === currency.code ? '' : currency.name
}

/** What a field needs besides being filled in, when it needs something more. */
export function fieldRule(field: Field): Markup {
  const rule = fieldRules[field]
  return rule === undefined
    ? html``
    : html`<span class="rule" data-rule-of="${field}">${rule}</span>`
}
