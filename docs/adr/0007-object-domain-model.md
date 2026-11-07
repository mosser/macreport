# ADR 0007: The report is an object model

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

The rules of a report (`docs/specs/`) are about its concepts: an expense refers
to at least one receipt and one bank statement, a document is in the report
once, a claimed amount is more than zero to the cent, a label is the letter of
a kind and a rank. Those rules must hold in the interface, in the draft and in
the report document alike, and they are read against the specification by
someone who knows McSCert's reimbursement rules and not TypeScript.

Options considered:

- **Plain records** (JSON-shaped objects) passed between modules, with
  validation functions. Close to how the draft is stored, but every module
  re-checks what it receives, and a broken invariant travels until something
  fails far away.
- **Immutable classes** that link to each other by reference and refuse a
  broken invariant in their constructor.

## Decision

- The report is an **object model** of immutable classes in `src/domain/`:
  `Report`, `Expense`, `Document` and their values (`Amount` in cents of
  Canadian dollars, `ForeignAmount` with its `Currency`, `CalendarDate`,
  `Kind`). A class throws from its constructor on a broken invariant; a change
  returns a new object, named `after…` (`report.afterAdding(expense)`).
- An expense refers to its documents **by reference**, not by identifier.
- A `Document` carries its content as bytes, which the domain never
  interprets: only `src/io/` reads them (ADR 0006).
- **Findings** are computed by the domain, from the report, and worded in one
  module, `src/domain/findings.ts`, each sentence pinned by an exact-string
  test. The interface shows them; it never words one.
- **The layout** of the report document (the order of sections and documents,
  labels, the numbering of expenses, pages of each document, the total) is
  computed by the domain. `src/io/` writes it and computes none of it.
- **Names are the glossary's** (`docs/specs/domain-model.md`): one word, one
  meaning. A new concept goes into the glossary first, then into a class with a
  test per invariant. No abbreviation and no single-letter name. Booleans are
  questions (`expense.hasBankStatement`); every `export` has a doc comment
  stating its rule in the specification's words.
- `src/domain/` imports nothing from `src/io/` or `src/ui/`, no PDF library and
  no browser API. Records exist only at the edges: the draft store
  (ADR 0008) turns the model into what IndexedDB keeps and back.

## Consequences

**Positive**

- A report that exists is a report whose invariants hold; the interface and the
  writer do not re-check.
- The rules of the specification can be read in the domain.
- The domain is tested in Node without a browser.

**Negative / accepted trade-offs**

- The draft store maps between the model and records in both directions, and
  has to be tested both ways.
- Immutability copies the report on each change; reports are small enough
  that this does not matter, and documents' bytes are shared, not copied.

## Compliance

A change is compliant with this ADR when:

- `src/domain/` imports nothing from `src/io/`, `src/ui/` or a PDF library, and
  uses no browser API;
- findings are worded only in `src/domain/findings.ts`, each with an
  exact-string test;
- the report document writer receives its layout from the domain;
- every term used in a domain name is in the glossary.
