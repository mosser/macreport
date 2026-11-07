# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
