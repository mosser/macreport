import { policy } from '../domain/policy.ts'
import { html } from './html.ts'

/**
 * Help, in a dialog over the step: the documents of the policy, each a link that opens it in a new
 * tab. Close, or Escape, takes it away.
 */
export function showHelp(page: Document): void {
  const dialog = page.createElement('dialog')
  dialog.className = 'help'
  dialog.setAttribute('aria-labelledby', 'help-title')
  const links = policy.documents.map(
    ({ name, url }) =>
      html`<li><a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></li>`,
  )
  dialog.innerHTML = html`<h2 id="help-title">Policy</h2>
    <ul>${links}</ul>
    <div class="actions">
      <button type="button" data-action="close-help" autofocus>Close</button>
    </div>`.text
  page.body.append(dialog)
  dialog.addEventListener('close', () => dialog.remove())
  dialog.querySelector('[data-action="close-help"]')?.addEventListener('click', () => {
    dialog.close()
  })
  dialog.showModal()
}
