import { CalendarDate } from '../domain/calendar-date.ts'
import { type Field, findingsOfReportStep } from '../domain/findings.ts'
import { type Position, positions, type Report, type ReportFields } from '../domain/report.ts'
import { isEmailAddress, textOrAbsent } from '../domain/text.ts'
import { fieldName, fieldRule } from './field.ts'
import { html, type Markup } from './html.ts'
import type { Context, Step } from './step.ts'

/** A value typed in a field: what the report keeps, and whether it breaks the field's rule. */
interface Typed {
  readonly changes: ReportFields
  readonly isBroken: boolean
}

const emailFields = new Set<string>(['email', 'supervisorEmail', 'hostEmail'])
const dateFields = new Set<string>(['firstDay', 'lastDay'])

function typed(report: Report, field: string, value: string): Typed {
  if (dateFields.has(field)) {
    const date = CalendarDate.parse(value)
    const isBefore =
      field === 'lastDay' && date !== undefined && report.firstDay !== undefined
        ? date.isBefore(report.firstDay)
        : false
    return {
      changes: { [field]: date },
      isBroken: (value !== '' && date === undefined) || isBefore,
    }
  }
  const text = textOrAbsent(value)
  if (emailFields.has(field) && text !== undefined && !isEmailAddress(text)) {
    return { changes: { [field]: undefined }, isBroken: true }
  }
  return { changes: { [field]: text }, isBroken: false }
}

/**
 * An email address of this form is no login: `data-bwignore` keeps Bitwarden from
 * offering to fill it with a username or a password, as `autocomplete="off"` does not.
 */
const notALogin = html`autocomplete="off" data-bwignore`

function input(field: Field, value: string, type: string): Markup {
  return html`<label class="field">
    ${fieldName(field)}
    <input name="${field}" type="${type}" value="${value}" ${type === 'email' ? notALogin : ''} />
    ${fieldRule(field)}
  </label>`
}

function positionSelect(position: Position | undefined): Markup {
  const options = positions.map((choice) => html`<option value="${choice}">${choice}</option>`)
  return html`<label class="field">
    ${fieldName('position')}
    <select name="position">
      <option value="" ${position === undefined ? html`selected` : ''}></option>
      ${options}
    </select>
  </label>`
}

/** A section of the form: its title, then its fields. */
function section(title: string, fields: Markup[]): Markup {
  return html`<fieldset class="section"><legend>${title}</legend>${fields}</fieldset>`
}

/** The section of the supervisor of a student or a postdoctoral fellow, or of a visitor's host. */
function supervisorOrHost(report: Report): Markup | undefined {
  if (report.asksForSupervisor) {
    return section('Supervisor', [
      input('supervisorName', report.supervisorName ?? '', 'text'),
      input('supervisorEmail', report.supervisorEmail ?? '', 'email'),
    ])
  }
  if (report.asksForHost) {
    return section('Host', [
      input('hostName', report.hostName ?? '', 'text'),
      input('hostEmail', report.hostEmail ?? '', 'email'),
    ])
  }
  return undefined
}

/** Step 1: the claimant, their supervisor or host, the purpose, the dates and locations of a business travel, the account's name and code. */
export const reportStep: Step = {
  title: 'Report',

  render(panel: HTMLElement, context: Context): void {
    const report = context.report
    panel.innerHTML = html`<h2>Report</h2>
      ${section('Claimant', [
        input('claimantName', report.claimantName ?? '', 'text'),
        positionSelect(report.position),
        input('email', report.email ?? '', 'email'),
      ])}
      ${supervisorOrHost(report)}
      ${section('Purpose', [
        input('purpose', report.purpose ?? '', 'text'),
        html`<label class="field checkbox">
          <input type="checkbox" name="businessTravel" ${report.isBusinessTravel ? html`checked` : ''} />
          ${fieldName('businessTravel')}
        </label>`,
        report.isBusinessTravel
          ? html`<div class="dates">
              ${input('firstDay', report.firstDay?.toString() ?? '', 'date')}
              ${input('lastDay', report.lastDay?.toString() ?? '', 'date')}
            </div>
            ${input('locations', report.locations ?? '', 'text')}`
          : html``,
      ])}
      ${section('Account', [
        input('accountName', report.accountName ?? '', 'text'),
        input('accountCode', report.accountCode ?? '', 'text'),
      ])}`.text

    const select = panel.querySelector('select')
    if (select !== null) {
      select.value = report.position ?? ''
    }
    select?.addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value
      const position = positions.find((choice) => choice === value)
      context.change(context.report.afterChanging({ position }))
      context.refresh()
    })
    panel
      .querySelector<HTMLInputElement>('[name="businessTravel"]')
      ?.addEventListener('change', (event) => {
        const isBusinessTravel = (event.target as HTMLInputElement).checked
        context.change(context.report.afterChanging({ isBusinessTravel }))
        context.refresh()
      })
    for (const element of panel.querySelectorAll<HTMLInputElement>(
      'input:not([type="checkbox"])',
    )) {
      element.addEventListener('input', () => {
        const { changes, isBroken } = typed(context.report, element.name, element.value)
        context.change(context.report.afterChanging(changes))
        panel
          .querySelector(`[data-rule-of="${element.name}"]`)
          ?.classList.toggle('is-broken', isBroken)
        context.refreshActions()
      })
    }
  },

  canContinue(report: Report): boolean {
    return findingsOfReportStep(report).length === 0
  },
}
