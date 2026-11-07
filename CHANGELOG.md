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
  the purpose with its first and last day, both optional, and the account.
  Required fields are marked with an asterisk, and Continue is offered once
  every one is valid.
- The Expenses step, for exactly one expense: its date, description and
  claimed amount in Canadian dollars, with one receipt and one bank statement,
  each a PDF, a JPEG image or a PNG image, dropped on its zone or chosen from
  the computer.
- The Review step: the cover and the sections as they will be written, or the
  findings that stand in the way, and **Save the report**.
- The report document, saved as `expense-report-<date>-<claimant>.pdf`,
  dated by the report's first day or else its earliest expense: a cover in
  place of the McSCert Expense Report Template (fields, attached information,
  table of expenses and total), then a section of receipts and a section of bank
  statements, each opened by a section page listing its documents with their
  pages. PDF pages are copied as they are, images placed on a Letter page of
  their own, and every page is stamped with its label, its expense and its
  page number. On screen, a label in the table of expenses opens its
  document, and the expense in a stamp goes back to its row on the cover.
  Text is written in Noto Sans, so names in the Latin, Greek and Cyrillic
  alphabets keep their accents.
- **New report**, which discards the report after confirmation.

### Known limitations

- No draft is kept: closing the page loses the report, and the system says so.
- One expense per report; no missing receipt, payment in cash, foreign amount
  or additional document.
- Files are not checked when added: a damaged or password-protected PDF fails
  when the report is saved.
- On section pages, labels and expense numbers are not links yet, nor is the
  label in a stamp.
