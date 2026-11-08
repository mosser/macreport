import { type Field, fieldNames, missingReceiptNotice } from '../domain/findings.ts'
import { MissingReceipt, type MissingReceiptFields } from '../domain/missing-receipt.ts'
import { textOrAbsent } from '../domain/text.ts'
import { fieldName, fieldRule } from './field.ts'
import { html, type Markup } from './html.ts'

/** What a missing receipt holds, or is not stated. */
const requiredFields: readonly Field[] = ['reasonForMissingReceipt', 'paidTo', 'jobTitle']

/** A field typed on one line, filled in with what the dialog starts with. */
function line(field: Field, value: string | undefined): Markup {
  return html`<label class="field">
    ${fieldName(field)}
    <input name="${field}" type="text" value="${value ?? ''}" autocomplete="off" />
    ${fieldRule(field)}
  </label>`
}

/**
 * Asks the Claimant what a missing receipt states, in a dialog over the step that holds everything
 * else until it is answered. Done is offered once what is required is filled in, and gives what
 * was stated; Cancel, or Escape, gives nothing. What is typed is kept only then.
 */
export function statedMissingReceipt(
  page: Document,
  start: Partial<MissingReceiptFields>,
): Promise<MissingReceipt | undefined> {
  const dialog = page.createElement('dialog')
  dialog.className = 'missing-receipt'
  dialog.setAttribute('aria-labelledby', 'missing-receipt-heading')
  dialog.innerHTML = html`<h2 id="missing-receipt-heading">${fieldNames.missingReceipt}</h2>
    <p class="notice">${missingReceiptNotice}</p>
    <label class="field">
      ${fieldName('reasonForMissingReceipt')}
      <textarea name="reasonForMissingReceipt" autofocus>${start.reason ?? ''}</textarea>
    </label>
    ${line('paidTo', start.paidTo)}
    <fieldset class="section">
      <legend>Additional information on the claimant</legend>
      ${line('jobTitle', start.jobTitle)}
      ${line('phoneExtension', start.phoneExtension)}
    </fieldset>
    <div class="actions">
      <button type="button" data-answer="cancel">Cancel</button>
      <button type="button" class="primary" data-answer="done">Done</button>
    </div>`.text
  page.body.append(dialog)
  const typedIn = (field: Field) =>
    dialog.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`)?.value ?? ''
  const done = dialog.querySelector<HTMLButtonElement>('[data-answer="done"]')
  const offerDone = () => {
    if (done !== null) {
      done.disabled = requiredFields.some((field) => textOrAbsent(typedIn(field)) === undefined)
    }
  }
  offerDone()
  dialog.addEventListener('input', offerDone)
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      const isDone = dialog.returnValue === 'done'
      const stated = isDone
        ? new MissingReceipt({
            reason: typedIn('reasonForMissingReceipt'),
            paidTo: typedIn('paidTo'),
            jobTitle: typedIn('jobTitle'),
            phoneExtension: typedIn('phoneExtension'),
          })
        : undefined
      dialog.remove()
      resolve(stated)
    })
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-answer]')) {
      button.addEventListener('click', () => dialog.close(button.dataset.answer))
    }
    dialog.showModal()
  })
}
