# ADR 0007: The report is an object model

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Sébastien Mosser

## Context

The rules of a report (`docs/specs/`) are about its concepts: an expense has a
receipt or a missing receipt, and a bank statement unless it was paid in cash;
a document is in the report once, and a receipt leaves it when no expense
refers to it any more; a claimed amount is more than zero to the cent; a label
is the letter of a kind and a rank. Those rules must hold in the interface, in the draft and in
the report document alike, and they are read against the specification by
someone who knows McSCert's reimbursement rules and not TypeScript.

A report is prepared over days, and the draft keeps it as the Claimant leaves
it (ADR 0008): a field still empty, an expense whose receipt is still to come.
The report document, though, is written only from a report with nothing
missing. Some rules hold at every moment; others say what a report must have
before it can be saved.

Options considered:

- **Plain records** (JSON-shaped objects) passed between modules, with
  validation functions. Close to how the draft is stored, but every module
  re-checks what it receives, and a broken invariant travels until something
  fails far away.
- **Immutable classes** that link to each other by reference and refuse a
  broken invariant in their constructor.

## Decision

- The report is an **object model** of immutable classes in `src/domain/`:
  `Report`, `Expense`, `MissingReceipt`, `Document` and their values (`Amount`
  in cents of Canadian dollars, `ForeignAmount` with its `Currency`,
  `CalendarDate`, `Kind`). A change returns a new object, named `after…`
  (`report.afterAdding(expense)`).
- **Two kinds of rules.**
  - **Invariants** hold in every draft, and a constructor throws when one is
    broken: an amount is a whole, positive number of cents; a date is a
    calendar date; a currency is a three-letter code other than CAD; a
    receipt is a document of the receipt kind, a bank statement of the bank
    statement kind; an expense never has both receipts and a missing receipt,
    and an expense paid in cash never has a bank statement; a missing receipt
    has a reason and says who was paid; a document is in the report once.
  - **Completeness** is what a report must have before it is saved, and is
    checked by findings, never by a constructor: required fields, at least
    one expense, a receipt or a missing receipt, a bank statement unless paid
    in cash, a last day not before the first, text the embedded
    font can write. A field the Claimant has not filled in is absent, never an
    invalid value.
- An expense refers to its documents **by reference**, not by identifier.
- A `Document` carries its content as bytes, which the domain never
  interprets: only `src/io/` reads them (ADR 0006).
- **Findings** are computed by the domain, from the report, and worded in one
  module, `src/domain/findings.ts`, each sentence pinned by an exact-string
  test. The interface shows them; it never words one.
- **The layout** of the report document (the order of sections and documents,
  labels, the numbering of expenses, the expenses each document supports, the
  total, what each link goes to) is computed by the domain, from a report
  without findings only: asking for the layout of a report with findings
  throws. `src/io/` writes it and computes none of it.
- **Pagination is the writer's.** How many pages the cover, a section page or
  a missing receipt authorization takes depends on measuring wrapped text in
  the embedded font (ADR 0006), so the writer breaks them into pages and
  writes the page numbers that follow: in section pages, in stamps, and as
  the destinations of links.
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
- The draft can hold, and restore, any report the Claimant may leave
  half-done; what is still missing is a list of findings, not an error.
- The rules of the specification can be read in the domain.
- The domain is tested in Node without a browser.

**Negative / accepted trade-offs**

- The draft store maps between the model and records in both directions, and
  has to be tested both ways.
- Immutability copies the report on each change; reports are small enough
  that this does not matter, and documents' bytes are shared, not copied.
- Completeness is not a type: code that needs a complete report checks its
  findings first, and the layout refuses a report that has some.

## Compliance

A change is compliant with this ADR when:

- `src/domain/` imports nothing from `src/io/`, `src/ui/` or a PDF library, and
  uses no browser API;
- findings are worded only in `src/domain/findings.ts`, each with an
  exact-string test;
- constructors check invariants only, and every completeness rule of the
  specification is a finding;
- the report document writer receives its layout from the domain, and
  computes only pages;
- every term used in a domain name is in the glossary.
