import { type Field, fieldNames, fieldRules, isRequired } from '../domain/findings.ts'
import { html, type Markup } from './html.ts'

/** The name of a field, with an asterisk when it is required. */
export function fieldName(field: Field, isFieldRequired = isRequired(field)): Markup {
  const asterisk = isFieldRequired ? html` <abbr class="required" title="required">*</abbr>` : ''
  return html`<span class="field-name" id="name-of-${field}">${fieldNames[field]}${asterisk}</span>`
}

/** What a field needs besides being filled in, when it needs something more. */
export function fieldRule(field: Field): Markup {
  const rule = fieldRules[field]
  return rule === undefined
    ? html``
    : html`<span class="rule" data-rule-of="${field}">${rule}</span>`
}
