import type { Report } from '../domain/report.ts'
import { additionalDocumentsStep } from './additional-documents-step.ts'
import { confirmed } from './confirmation.ts'
import type { ReadFile } from './document-field.ts'
import type { DocumentLinks } from './document-link.ts'
import { expensesStep } from './expenses-step.ts'
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
  readonly readFile: ReadFile
  readonly saveReport: SaveReport
  /** Links that open a document in a new tab, from the bytes the Claimant added. */
  readonly links: DocumentLinks
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
    expensesStep(options.readFile, options.links),
    additionalDocumentsStep(options.readFile),
    reviewStep(options.saveReport, () => isDraftKept, options.links),
  ]
  let report = options.draft
  let isDraftKept = options.isDraftKept
  let isDiscardRefused = false
  let session = 0
  let current = 0
  let reached = 0
  /** The files being added to the report, which hold Continue and the steps ahead. */
  let additions = new Set<Promise<unknown>>()

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
    adding(addition: Promise<unknown>) {
      const pending = additions
      pending.add(addition)
      refreshActions()
      void addition
        .catch(() => undefined)
        .finally(() => {
          pending.delete(addition)
          refreshActions()
        })
    },
  }

  function stepAt(index: number): Step {
    const step = steps[index]
    if (step === undefined) {
      throw new RangeError(`There is no step ${index}`)
    }
    return step
  }

  function go(index: number): void {
    if (index !== current) {
      stepAt(current).leave?.()
    }
    current = index
    reached = Math.max(reached, index)
    refresh()
  }

  /**
   * Starts a new report for the same claimant once the browser has deleted the draft, and keeps
   * the claimant as the new draft; says so when the browser did not delete it.
   */
  async function startNewReport(): Promise<void> {
    isDiscardRefused = !(await options.discard())
    if (!isDiscardRefused) {
      context.change(report.afterNewReport())
      session += 1
      reached = 0
      // What is still being added belongs to the report discarded, and holds nothing up.
      additions = new Set()
      options.links.forgetAll()
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
          <button class="primary" data-action="continue">Continue</button>
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
    root.querySelector('[data-action="new-report"]')?.addEventListener('click', async () => {
      const isConfirmed = await confirmed(root.ownerDocument, {
        question: 'Discard this report, its expenses and its documents?',
        details: [],
        action: 'Discard',
      })
      if (isConfirmed) {
        await startNewReport()
      }
    })
    root.querySelector('[data-action="back"]')?.addEventListener('click', () => go(current - 1))
    root.querySelector('[data-action="continue"]')?.addEventListener('click', () => go(current + 1))
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-step]')) {
      button.addEventListener('click', () => go(Number(button.dataset.step)))
    }
    refreshActions()
  }

  /**
   * Offers Continue, Back and the steps of the stepper as the step allows: none while it holds
   * them, nor the steps ahead while a file is being added. What a step marks `data-held` waits
   * for both, what it marks `data-held-while-adding` for the file only.
   */
  function refreshActions(): void {
    const isAdding = additions.size > 0
    const step = stepAt(current)
    const isHeld = step.holdsSteps?.() ?? false
    const canContinue = step.canContinue(report) && !isAdding && !isHeld
    const continueButton = root.querySelector<HTMLButtonElement>('[data-action="continue"]')
    if (continueButton !== null) {
      continueButton.disabled = !canContinue
      continueButton.hidden = current === steps.length - 1 || !(step.offersContinue?.() ?? true)
    }
    const backButton = root.querySelector<HTMLButtonElement>('[data-action="back"]')
    if (backButton !== null) {
      backButton.disabled = isHeld
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-step]')) {
      const index = Number(button.dataset.step)
      button.disabled =
        index > reached || (isAdding && index > current) || (isHeld && index !== current)
    }
    for (const element of root.querySelectorAll<HTMLButtonElement>('[data-held]')) {
      element.disabled = isAdding || isHeld
    }
    for (const element of root.querySelectorAll<HTMLButtonElement>('[data-held-while-adding]')) {
      element.disabled = isAdding
    }
  }

  // A file dropped outside a drop zone would make the browser open it, and lose the report.
  for (const kind of ['dragover', 'drop']) {
    root.ownerDocument.addEventListener(kind, (event) => event.preventDefault())
  }
  refresh()
}
