import { html, type Markup } from './html.ts'

/** What a confirmation asks: its question, what it is about, and the action it confirms. */
export interface Confirmation {
  readonly question: string
  /** What the question is about, a paragraph each; none when the question says it all. */
  readonly details: readonly string[]
  /** The button that confirms, as Discard or Remove; Cancel is always offered. */
  readonly action: string
}

/**
 * Asks the Claimant to confirm, in a dialog over the step that holds everything else until it
 * is answered; gives whether they confirmed. Cancel, or Escape, does not.
 */
export function confirmed(page: Document, confirmation: Confirmation): Promise<boolean> {
  const dialog = page.createElement('dialog')
  dialog.className = 'confirmation'
  dialog.setAttribute('aria-labelledby', 'confirmation-question')
  const details: Markup[] = confirmation.details.map((detail) => html`<p>${detail}</p>`)
  dialog.innerHTML = html`<h2 id="confirmation-question">${confirmation.question}</h2>
    ${details}
    <div class="actions">
      <button type="button" data-answer="cancel" autofocus>Cancel</button>
      <button type="button" class="primary" data-answer="confirm">${confirmation.action}</button>
    </div>`.text
  page.body.append(dialog)
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => {
      dialog.remove()
      resolve(dialog.returnValue === 'confirm')
    })
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-answer]')) {
      button.addEventListener('click', () => dialog.close(button.dataset.answer))
    }
    dialog.showModal()
  })
}
