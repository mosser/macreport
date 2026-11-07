# ADR 0010: The report document takes the place of the McSCert template and its attachments

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

McSCert's administration reimburses from the McSCert Expense Report Template
(revision August 2023), filled in by hand, and the supporting documents
attached to it. The template asks for the claimant's name and position, the
event and its dates, a checklist of the attached information, a table of
transactions (date, description, amount in foreign currency, rate, amount
claimed in Canadian dollars) and the suggested accounts. McMaster accepts a
signed Missing Receipt Authorization Form in place of a missing receipt or
boarding pass.

The administration's work is to match each line of the table with its receipt
and its bank statement, among pages that arrive in no particular order, often
printed.

Options considered:

- **Fill in the template's PDF form** and append the documents. Keeps the
  official layout, but the form has ten table rows, a report often has more,
  and nothing links a row to its pages.
- **A cover of the system's own**, carrying the template's fields and table,
  followed by the documents with the means to go from a row to its pages.

## Decision

The report document is written as `docs/specs/report-document.md` says:

- **A cover** that carries every field of the template and its table, and so
  replaces it. It has no exchange-rate column: every expense has a bank
  statement, and the template asks for a rate only when there is none.
- **One section per kind of document**, in the order of the template's
  checklist, each opened by a **section page** that lists its documents with
  their pages and the expenses they support. The Missing Receipt Authorization
  Form is a kind of its own, added by the Claimant filled in and signed: the
  system does not fill it in.
- **A label per document** (R3), used in the cover's table, on section pages,
  and in the **stamp** on every page with the page number out of the total, so
  that a printed copy can be followed from a row to its pages and back.
- **A document is in the report document once**, however many expenses it
  supports.
- **Text the standard fonts cannot write is a finding**, never replaced: the
  Claimant decides how to write it.
- **No redaction.** Drawing over a PDF hides text on screen and leaves it in
  the file, so the system does not offer it: bank statements are redacted
  before they are added, and the Documents step says so.

## Consequences

**Positive**

- One file holds everything the administration needs, in an order it can
  follow, with nothing to fill in by hand.
- A report has as many expenses as it needs.

**Negative / accepted trade-offs**

- The cover is not the template itself. If the administration requires the
  official form, the cover is changed to fill it in, and this ADR amended.
- A character outside Windows-1252 (an arrow, an emoji, a name in a non-Latin
  script) has to be written otherwise by the Claimant.
- Missing receipt authorizations are prepared outside the system.

## Compliance

A change is compliant with this ADR when:

- the report document follows `docs/specs/report-document.md`, and a change to
  its layout changes that spec in the same commit;
- tests read the written report document back and check its order, its pages,
  its labels and its stamps.
