import type { Report } from '../domain/report.ts'

/** What a step reaches of the wizard: the draft, and the two ways to update the screen. */
export interface Context {
  /** The report as the Claimant left it. */
  readonly report: Report
  /** Counts the reports started, so that what finishes after New report is not added to the new one. */
  readonly session: number
  /** Keeps a change of the report, without rendering the step again. */
  change(report: Report): void
  /** Renders the step again, after a click. */
  refresh(): void
  /** Re-evaluates the actions of the wizard, after a typed edit. */
  refreshActions(): void
  /**
   * Holds Continue and the steps ahead until a file being added to the report is, or has failed
   * to be: the report is not reviewed, nor saved, without it.
   */
  adding(addition: Promise<unknown>): void
}

/** A screen of the wizard. */
export interface Step {
  readonly title: string
  render(panel: HTMLElement, context: Context): void
  /** Whether Continue is offered. */
  canContinue(report: Report): boolean
  /** Whether Continue is shown at all; it is, unless the step says otherwise. */
  offersContinue?(): boolean
  /**
   * Whether the step holds Back and every other step, as while a value typed breaks its rule:
   * leaving would lose it. It is not, unless the step says otherwise.
   */
  holdsSteps?(): boolean
  /** Forgets what the step showed, as the wizard goes to another step. */
  leave?(): void
}
