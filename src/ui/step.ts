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
}

/** A screen of the wizard. */
export interface Step {
  readonly title: string
  render(panel: HTMLElement, context: Context): void
  /** Whether Continue is offered. */
  canContinue(report: Report): boolean
}
