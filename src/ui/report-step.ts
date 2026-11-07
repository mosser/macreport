import { CalendarDate } from '../domain/calendar-date.ts'
import { type Field, fieldNames, fieldRules, findingsOfReportStep } from '../domain/findings.ts'
import { type Position, positions, type Report, type ReportFields } from '../domain/report.ts'
import { isEmailAddress, textOrAbsent } from '../domain/text.ts'
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

function input(field: Field, value: string, type: string): Markup {
  return html`<label class="field">
    <span class="field-name">${fieldNames[field]}</span>
    <input name="${field}" type="${type}" value="${value}" />
    <span class="rule" data-rule-of="${field}">${fieldRules[field]}</span>
  </label>`
}

function positionSelect(position: Position | undefined): Markup {
  const options = positions.map(
    (choice) =>
      html`<option value="${choice}" ${choice === position ? html`selected` : ''}>${choice}</option>`,
  )
  return html`<label class="field">
    <span class="field-name">${fieldNames.position}</span>
    <select name="position">
      <option value="" ${position === undefined ? html`selected` : ''}></option>
      ${options}
    </select>
    <span class="rule">${fieldRules.position}</span>
  </label>`
}

/** Step 1: the claimant, the event, its dates and the account. */
export const reportStep: Step = {
  title: 'Report',

  render(panel: HTMLElement, context: Context): void {
    const report = context.report
    panel.innerHTML = html`<h2>Report</h2>
      ${input('claimantName', report.claimantName ?? '', 'text')}
      ${positionSelect(report.position)}
      ${input('email', report.email ?? '', 'email')}
      ${report.asksForSupervisor ? input('supervisorName', report.supervisorName ?? '', 'text') : ''}
      ${report.asksForSupervisor ? input('supervisorEmail', report.supervisorEmail ?? '', 'email') : ''}
      ${report.asksForHost ? input('hostName', report.hostName ?? '', 'text') : ''}
      ${report.asksForHost ? input('hostEmail', report.hostEmail ?? '', 'email') : ''}
      ${input('event', report.event ?? '', 'text')}
      ${input('firstDay', report.firstDay?.toString() ?? '', 'date')}
      ${input('lastDay', report.lastDay?.toString() ?? '', 'date')}
      ${input('account', report.account ?? '', 'text')}`.text

    panel.querySelector('select')?.addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value
      const position = positions.find((choice) => choice === value)
      context.change(context.report.afterChanging({ position }))
      context.refresh()
    })
    for (const element of panel.querySelectorAll('input')) {
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
