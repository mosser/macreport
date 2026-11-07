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
claimed in Canadian dollars) and the suggested account. When a receipt is
missing, McMaster accepts its Missing Receipt Authorization Form instead,
filled in and signed by the claimant.

The administration's work is to match each line of the table with its receipt
and its bank statement, among pages that arrive in no particular order, often
printed.

Options considered:

- **Fill in the template's PDF form** and append the documents. Keeps the
  official layout, but the form has ten table rows, a report often has more,
  and nothing links a row to its pages.
- **A cover of the system's own**, carrying the template's fields and table,
  followed by the documents with the means to go from a row to its pages.

Options considered for a missing receipt:

- **The Claimant fills in McMaster's form** and adds it as a document. Retypes
  what the report already knows: date, amount, description, name, title.
- **The system writes the form**, filled in from the report, and the Claimant
  signs it. McMaster's form is not a fillable PDF, so the system reproduces
  its wording and layout.

## Decision

The report document is written as `docs/specs/report-document.md` says:

- **A cover** that carries every field of the template and its table, and so
  replaces it, with the claimant's email and, for a student or a visitor,
  the name and email of their supervisor or host, so that the administration
  can reach them. The foreign amount is shown for information; there is no
  exchange-rate column and nothing is converted: the system does not deal
  with exchange rates.
- **Four kinds of document**, each a section opened by a **section page** that
  lists its documents with their pages and the expenses they support:
  receipts, missing receipt authorizations, bank statements, additional
  documents. Receipts and bank statements are added from the expenses they
  support; additional documents (invitation, itinerary, boarding passes,
  notes) from the report.
- **A missing receipt authorization per expense without a receipt**, written
  by the system in McMaster's wording, filled in from the expense and the
  report, its signature line left blank. The Claimant signs the saved report
  document, on paper or with a PDF reader.
- **An expense paid in cash** has no bank statement; the cover says *cash*
  where its statement's label would be.
- **A label per document** (R3), used in the cover's table, on section pages,
  and in the **stamp** on every page with the numbers of the expenses the
  document supports and the page number out of the total, so that a printed
  copy can be followed from a row to its pages and back, and every page says
  which expenses it is for.
- **Labels and expense numbers are links**, so that on screen a click goes
  from a row of the cover to its document, and from a page of a document back
  to the rows of the expenses it supports.
- **A document is in the report document once**, however many expenses it
  supports.
- **Text the embedded font cannot write is a finding**, never replaced: the
  Claimant decides how to write it (ADR 0006).
- **Redaction is the Claimant's, before or after.** The Claimant redacts a
  bank statement before adding it, or redacts the saved report document with
  a PDF reader's redaction tool, which works on it since the pages of PDF
  documents are copied with their text. The system does not redact: drawing
  over a PDF hides text on screen and leaves it in the file, which would look
  like redaction without being one.

## Consequences

**Positive**

- One file holds everything the administration needs, in an order it can
  follow, with nothing to fill in by hand but a signature on each missing
  receipt authorization.
- A report has as many expenses as it needs.
- On screen, a reader goes from a row to its receipt and back in one click;
  on paper, the stamp of each page names the expenses it supports.

**Negative / accepted trade-offs**

- The cover is not the template itself, and the missing receipt authorization
  is a reproduction of McMaster's form. If the administration requires the
  official documents, this ADR is amended.
- When McMaster changes the wording of its form, the system changes with it.
- A report document with a missing receipt authorization is not complete until
  the Claimant has signed it.

## Compliance

A change is compliant with this ADR when:

- the report document follows `docs/specs/report-document.md`, and a change to
  its layout or to the wording of the missing receipt authorization changes
  that spec in the same commit;
- tests read the written report document back and check its order, its pages,
  its labels, its stamps, the target of each link and the fields of each
  missing receipt authorization.
