# ADR 0005: The interface is a step-by-step wizard built on the DOM, without a framework

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

The Claimant prepares a report in four steps (`docs/specs/prepare-an-expense-report.md`):
Report, Expenses, Additional documents, Review. Each is a form, a list or a table, with a
handful of buttons. There is one user, no routing, no state shared between
distant components and no real-time update. ADR 0001 leaves the framework
open; every screen depends on the choice.

Options considered:

- **A component framework** (React, Vue, Svelte, Preact, Lit). Reactive
  rendering and an ecosystem, at the cost of a dependency to pin and bump, a
  build integration, and more bytes in the single file.
- **The DOM directly, with a small in-house rendering helper.** No dependency,
  nothing to learn beyond the platform; every re-render and event binding is
  written by hand.

## Decision

The interface uses **the DOM directly**, with two small in-house pieces.

- **Rendering.** A view is a function that sets `innerHTML` from the `html`
  tagged template of `src/ui/html.ts`, which escapes every interpolated value.
  Already-safe markup is wrapped in `raw()`, and templates nest. Listeners are
  attached after rendering, by querying the fresh DOM. A file name, a
  description or any text the Claimant typed is never inserted without
  escaping.
- **Steps.** Each step implements the `Step` interface of `src/ui/step.ts`:
  `render(panel, ctx)`, `canContinue(draft)` and an optional `leave()`, which
  forgets what the step showed, such as the expense whose fields are open,
  as the wizard goes to another step.
  The wizard (`src/ui/wizard.ts`) owns the step index, the stepper, the
  Back/Continue actions, New report, and the notice shown when the draft
  cannot be kept.
- **Two ways to update.** After a click, a step changes the draft and calls
  `ctx.refresh()`, which re-renders. While the Claimant types, the step does not
  re-render, which would lose focus: it updates the affected DOM in place and
  calls `ctx.refreshActions()` to re-evaluate Continue.
- **Confirmations** are a modal `<dialog>` over the step
  (`src/ui/confirmation.ts`), answered with Cancel, Escape, or the button
  naming the action. The browser's own `confirm()` is not used: it cannot
  take the palette, nor name the documents an action takes away, and a test
  cannot answer it.
- **Files** are added through an `<input type="file">` and by dropping them on
  the step; both go through the same handler.
- **Styling** is `src/style.css`, which holds the palette (ADR 0002) and every
  rule.
- **Footer.** Under the wizard, every step shows the system and its version,
  McSCert and McMaster University, then the privacy statement: what the
  Claimant enters and adds stays in this browser, on this computer, and
  nothing is collected, sent or shared (ADR 0001). Receipts and bank
  statements are personal and financial data, and a Claimant handing them to
  a web page is entitled to know where they go.

## Consequences

**Positive**

- No framework to pin, bump or bundle; the single file stays small.
- Escaping is in one place, and tested.
- A step can be tested by rendering it into a detached element with
  `happy-dom` and dispatching events (ADR 0004).

**Negative / accepted trade-offs**

- No reactivity: a step that forgets `ctx.refresh()` shows stale content.
- Large views are built from named fragments by hand.

## Compliance

A change is compliant with this ADR when:

- `package.json` lists no UI framework or virtual-DOM library;
- markup is produced by the `html` template only, and `raw()` wraps only markup
  built by the system, never text the Claimant typed or a file name;
- each screen of the wizard is a `Step`, and typed edits do not re-render;
- a confirmation is asked through `src/ui/confirmation.ts`, never `confirm()`;
- every colour in `src/ui/` is a `var(--…)`.
