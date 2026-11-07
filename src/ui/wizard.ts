import { Report } from '../domain/report.ts'
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
  /** The draft the browser kept, or an empty report. */
  readonly draft: Report
  /** Whether the browser keeps the draft. */
  readonly isDraftKept: boolean
  /** Keeps the report as the draft, at once; gives whether the browser kept it. */
  readonly keep: (report: Report) => Promise<boolean>
  /** Deletes the draft and its documents, for New report; gives whether the browser did. */
  readonly discard: () => Promise<boolean>
}

/**
 * The wizard: the steps one after the other, Back and Continue, the stepper to go back to any step
 * already reached, and New report on every step.
 */
export function mountWizard(root: HTMLElement, options: WizardOptions): void {
  const steps: readonly Step[] = [
    reportStep,
    expensesStep(options.readFile),
    reviewStep(options.saveReport, () => isDraftKept),
  ]
  let report = options.draft
  let isDraftKept = options.isDraftKept
  let isDiscardRefused = false
  let session = 0
  let current = 0
  let reached = 0

  const context: Context = {
    get report() {
      return report
    },
    get session() {
      return session
    },
    change(changed: Report) {
      report = changed
      void options.keep(changed).then((isKept) => {
        isDraftKept = isKept
        root.querySelector<HTMLElement>('[data-notice="draft"]')?.toggleAttribute('hidden', isKept)
      })
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

  /** Starts a new report once the browser has deleted the draft; says so when it did not. */
  async function startNewReport(): Promise<void> {
    isDiscardRefused = !(await options.discard())
    if (!isDiscardRefused) {
      report = new Report()
      session += 1
      reached = 0
    }
    go(isDiscardRefused ? current : 0)
  }

  function refresh(): void {
    const stepper = steps.map((step, index) => {
      const isCurrent = index === current ? html`aria-current="step"` : ''
      return html`<li><button data-step="${index}" ${isCurrent}>${index + 1}. ${step.title}</button></li>`
    })
    const draftNotice = isDraftKept ? html`hidden` : ''
    const discardNotice = isDiscardRefused ? '' : html`hidden`
    root.innerHTML = html`<header class="masthead">
        <img src="${options.logo}" alt="McSCert" />
        <h1>McSCert Expense Report</h1>
        <button class="new-report" data-action="new-report">New report</button>
      </header>
      <main>
        <p class="notice" data-notice="draft" ${draftNotice}>No draft is kept: closing the page will lose the report.</p>
        <p class="notice" data-notice="discard" role="alert" ${discardNotice}>The browser did not delete the draft: it is still kept, bank statements included.</p>
        <ol class="stepper">${stepper}</ol>
        <section class="panel"></section>
        <div class="actions">
          <button data-action="back" ${current === 0 ? html`hidden` : ''}>Back</button>
          <button class="primary" data-action="continue"
            ${current === steps.length - 1 ? html`hidden` : ''}>Continue</button>
        </div>
      </main>
      <footer>
        <p>McSCert Expense Report v${options.version} · McSCert · McMaster University</p>
        <p class="privacy">Everything you enter and add stays in this browser, on this computer. Nothing is collected, sent or shared.</p>
      </footer>`.text

    const panel = root.querySelector<HTMLElement>('.panel')
    if (panel !== null) {
      stepAt(current).render(panel, context)
    }
    root.querySelector('[data-action="new-report"]')?.addEventListener('click', () => {
      if (options.confirm('Discard this report, its expense and its documents?')) {
        void startNewReport()
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
