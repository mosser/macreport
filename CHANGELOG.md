# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Location(s)**: a business travel now requires where it took the
  claimant, written on the cover under its dates. A draft of a business
  travel kept before this version asks for it at the Report step.
- Per diems for a business travel. **Manage per diems**, next to **Add an
  expense**, lists every day of the travel, each domestic or international
  (**All domestic** and **All international** set every day at once), with
  breakfast (28.40), lunch (27.40) and dinner (57.70) to tick, in Canadian
  dollars for a domestic day and in US dollars for an international one, and
  an optional reason for each meal not claimed. The days claimed and their
  total show above the expenses; a report may claim per diems only. The
  Review step shows them in a section of their own, then the total of the
  report. In the report document, each day with a meal claimed is a row of
  the cover's table, among the expenses by date, with its Entered box, and
  its meals not claimed and their reasons under it; an international per
  diem is in the foreign amount column, in US dollars, and in the total by
  currency. Changing the dates drops the per diems of the days left out;
  unticking business travel drops them all.

- Several expenses per report. The Expenses step lists them, sorted by date,
  each with its amounts, its documents, each a link that opens it in a new
  tab, and, in red, what it still lacks. **Add an expense**, above the list,
  opens empty fields, **Change** (a pen) opens an
  expense's fields filled in, and **Done** goes back to the list, where
  Continue is offered again; every change is kept as it is typed.
- **Remove** (a trash can) takes an expense out of the report once
  confirmed. A receipt or a bank statement no other expense uses leaves the
  report with it, and the confirmation names each.
- A receipt or a bank statement already in the report can be chosen for
  another expense, under **Or choose one already added**: one bank statement
  for every expense of a trip. A file added again, with the same content, is
  not added twice: the document already there is chosen, and the step says
  so (*Already in the report, as Visa, October: chosen.*).
- **Paid in another currency**: an expense's foreign amount and its currency,
  a three-letter ISO 4217 code, suggested with its name as it is typed. Its claimed amount
  in Canadian dollars may then be left empty, for McSCert to work out. On the
  cover, the total gives the sum of the claimed amounts, then, one per line,
  the sum of each currency's foreign amounts left without a claimed amount
  (`EUR 55.00`).

### Changed

- New report asks for confirmation in a dialog over the step, rather than in
  the browser's own.
- The trash can next to a receipt or a bank statement takes it out of this
  expense only; the document leaves the report once no expense uses it.

### Known limitations

- No missing receipt or payment in cash.
- The Additional documents step does not show how many pages each document
  has.
- Files are not checked when added: a damaged or password-protected PDF is
  found only when the report is saved, and the Review step then says so.
- On section pages, labels are not links yet, nor is the label in a stamp.
- Photos are embedded as they are added: a report of many phone photos is
  large, and a HEIC photo is not accepted.

## [0.2.0] - 2026-11-07

### Added

- The Additional documents step, between Expenses and Review. A business
  travel needs at least one travel justification (an invitation letter, a
  conference programme); other additional documents (an itinerary, a poster,
  boarding passes) are optional. Each is dropped on its zone or chosen from
  the computer, several at once if need be, and can be removed.
- A receipt or a bank statement can be removed from the expense, as any
  document can, with the trash can next to it. While the expense has its
  receipt, or its bank statement, the zone to add one is hidden.
- In the report document, the additional documents come first, right after
  the cover, labelled A1, A2…: the travel justifications, then the others.
  Of a business travel, their section page lists them under two subheadings,
  Travel justifications and Other documents. It lists no expenses, and the
  stamp of their pages gives their name: `A1 · Invitation from ICSE · 3 / 9`.
- A name for every document, receipts and bank statements included: its file
  name without its extension (`scan-0042.pdf` is named `scan-0042`), unless
  the Claimant types another next to it. No two documents have the same
  name: a file added under a name already taken is numbered (`scan-0042
  (2)`), and a name typed that another document has must be changed. The Review step and the
  report document call each document by its name.
- An **Entered** box for each expense on the cover: a form field McSCert's
  administrative staff tick on screen, or by hand on a printed copy, once
  they have entered the expense.

### Changed

- On the cover, each expense takes two lines: its fields, then its supporting
  documents by name, each a link to its document, rather than a column of
  labels (R1, S1). Section pages have a Name column in place of File, and
  name the expenses a document supports by their description, each a link to
  its row on the cover, rather than by their number.
- The Review step shows the expenses the same way, without the Entered
  boxes, which belong to the report document. Its tables of documents are
  spaced alike, and a document's name opens it in a new tab of the browser;
  links are a lighter maroon.
- Every page of the report document is US Letter. A Letter page of a PDF
  document stays as it is; a larger one, an A4 invoice say, is scaled down
  just enough to fit the page (to 94 %); a smaller one, a till receipt, keeps
  its size and is centred.
- On the cover, the title and the date it was written sit in the top right
  corner, level with the logo, and Attached information lists the kinds of
  document in alphabetical order.
- A business travel cannot be saved until it has a travel justification: a
  draft of a business travel kept by 0.1.0 asks for one at the Review step.
  Unticking Business travel takes the travel justifications out of the report.
- Errors (a rule a value breaks, the findings, a report that could not be
  written) are shown in red, mixed from McMaster's pink and maroon, rather
  than amber.
- **New report** keeps the claimant's name, position and email, and starts
  the new report with them; the supervisor or host, the purpose, the dates,
  the account, the expenses and every document are still deleted.

### Fixed

- A description written on several lines keeps its line breaks on the Review
  step, as on the cover, and is written on one line in the stamps, where it
  could run over several.
- A photo taken with a phone shows upright: a JPEG image is turned, and
  mirrored, as its Exif orientation says, where it could show on its side.
- A receipt or a bank statement could be missing from the draft when the page
  was opened again, if the report changed while the file was being kept: the
  draft is now kept one change after the other.

### Known limitations

- One expense per report; no missing receipt, payment in cash or foreign
  amount.
- The Additional documents step does not show how many pages each document
  has.
- Files are not checked when added: a damaged or password-protected PDF is
  found only when the report is saved, and the Review step then says so.
- On section pages, labels are not links yet, nor is the label in a stamp.
- Photos are embedded as they are added: a report of many phone photos is
  large, and a HEIC photo is not accepted.

## [0.1.0] - 2026-11-07

The first version, `0.1.0`: a minimal report, from one expense to one PDF.

### Added

- One HTML file, `macreport-v0.1.0.html`, that opens in a browser from disk
  and sends nothing over a network.
- The Report step, in sections: the claimant (name, position, email), the
  supervisor of a student or a postdoctoral fellow or the host of a visitor,
  the purpose, ticked as a business travel when it has dates, then its first
  and last day, and the account. Required fields are marked with an asterisk,
  and Continue is offered once every one is valid.
- The draft: the browser keeps the report as it is left, fields, expense and
  documents, from one opening to the next. When the browser refuses, the
  system says on every step that closing the page will lose the report.
- The Expenses step, for exactly one expense: its date, description and
  claimed amount in Canadian dollars, with one receipt and one bank statement,
  each a PDF, a JPEG image or a PNG image, dropped on its zone or chosen from
  the computer.
- The Review step: the cover and the sections as they will be written, or the
  findings that stand in the way, and **Save the report**.
- The report document, saved as `expense-report-<date>-<claimant>.pdf`, dated
  by the first day of a business travel or else the earliest expense: a cover
  in place of the McSCert Expense Report Template (fields, attached
  information, table of expenses and total), then a section of receipts and a
  section of bank statements, each opened by a section page listing its
  documents with their pages. Every page is portrait: PDF pages are copied
  with their size and content, turned a quarter when landscape, and images
  placed on a Letter page of their own, turned when wider than tall. Every
  page is stamped, upright, with its label, its expense (number and the first
  30 characters of its description) and its page number. On screen, a label in
  the table of expenses opens its document, and the expense in a stamp goes
  back to its row on the cover. Text is written in Noto Sans, so names in the
  Latin, Greek and Cyrillic alphabets keep their accents.
- A footer on every step with the version of the system, and the statement
  that everything entered and added stays in the browser, on the computer:
  nothing is collected, sent or shared.
- **New report**, which deletes the draft and its documents after
  confirmation, and empties the form.
- The latest version, served at <https://mosser.github.io/macreport/>, next
  to the file attached to each release. There, the draft carries over from
  one version to the next.

### Known limitations

- One expense per report; no missing receipt, payment in cash, foreign amount
  or additional document.
- Files are not checked when added: a damaged or password-protected PDF is
  found only when the report is saved, and the Review step then says so.
- On section pages, labels and expense numbers are not links yet, nor is the
  label in a stamp.
