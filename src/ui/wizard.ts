import { type Claimant, Report } from '../domain/report.ts'
import { expensesStep, type ReadFile } from './expenses-step.ts'
import { html } from './html.ts'
import { reportStep } from './report-step.ts'
import { reviewStep, type SaveReport } from './review-step.ts'
import type { Context, Step } from './step.ts'

/** What the wizard needs from the page it runs in. */
export interface WizardOptions {
  /** The version of the system, shown in the footer. */
  readonly version: string
  /** The reversed McSCert logo, for the maroon header bar. */
  readonly logo: string
  /** Asks the Claimant to confirm, as New report does. */
  readonly confirm: (question: string) => boolean
  readonly readFile: ReadFile
  readonly saveReport: SaveReport
  /** The claimant remembered from the previous report. */
  readonly claimant: Claimant
  /** Remembers the claimant for the next report, each time it changes. */
  readonly remember: (claimant: Claimant) => void
}

function isSameClaimant(one: Claimant, other: Claimant): boolean {
  return (
    one.claimantName === other.claimantName &&
    one.position === other.position &&
    one.email === other.email
  )
}

/**
 * The wizard: the steps one after the other, Back and Continue, the stepper to go back to any step
 * already reached, and New report on every step.
 */
export function mountWizard(root: HTMLElement, options: WizardOptions): void {
  const steps: readonly Step[] = [
    reportStep,
    expensesStep(options.readFile),
    reviewStep(options.saveReport),
  ]
  let report = new Report(options.claimant)
  let current = 0
  let reached = 0

  const context: Context = {
    get report() {
      return report
    },
    change(changed: Report) {
      if (!isSameClaimant(report.claimant, changed.claimant)) {
        options.remember(changed.claimant)
      }
      report = changed
    },
    refresh,
    refreshActions,
  }

  function stepAt(index: number): Step {
    const step = steps[index]
    if (step === undefined) {
      throw new RangeError(`There is no step ${index}`)
    }
    return step
  }

  function go(index: number): void {
    current = index
    reached = Math.max(reached, index)
    refresh()
  }

  function refresh(): void {
    root.innerHTML = html`<header class="masthead">
        <img src="${options.logo}" alt="McSCert" />
        <h1>McSCert Expense Report</h1>
        <button class="new-report" data-action="new-report">New report</button>
      </header>
      <main>
        <p class="notice">No draft is kept: closing the page will lose the report.</p>
        <ol class="stepper">
          ${steps.map(
            (step, index) => html`<li><button data-step="${index}"
              ${index === current ? html`aria-current="step"` : ''}>${index + 1}. ${step.title}</button></li>`,
          )}
        </ol>
        <section class="panel"></section>
        <div class="actions">
          <button data-action="back" ${current === 0 ? html`hidden` : ''}>Back</button>
          <button class="primary" data-action="continue"
            ${current === steps.length - 1 ? html`hidden` : ''}>Continue</button>
        </div>
      </main>
      <footer>McSCert · McMaster University · v${options.version}</footer>`.text

    const panel = root.querySelector<HTMLElement>('.panel')
    if (panel !== null) {
      stepAt(current).render(panel, context)
    }
    root.querySelector('[data-action="new-report"]')?.addEventListener('click', () => {
      if (options.confirm('Discard this report, its expense and its documents?')) {
        report = report.newReport()
        reached = 0
        go(0)
      }
    })
    root.querySelector('[data-action="back"]')?.addEventListener('click', () => go(current - 1))
    root.querySelector('[data-action="continue"]')?.addEventListener('click', () => go(current + 1))
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-step]')) {
      button.addEventListener('click', () => go(Number(button.dataset.step)))
    }
    refreshActions()
  }

  function refreshActions(): void {
    const canContinue = stepAt(current).canContinue(report)
    const continueButton = root.querySelector<HTMLButtonElement>('[data-action="continue"]')
    if (continueButton !== null) {
      continueButton.disabled = !canContinue
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-step]')) {
      button.disabled = Number(button.dataset.step) > reached
    }
  }

  // A file dropped outside a drop zone would make the browser open it, and lose the report.
  for (const kind of ['dragover', 'drop']) {
    root.ownerDocument.addEventListener(kind, (event) => event.preventDefault())
  }
  refresh()
}
