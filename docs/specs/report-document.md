# Report Document

The single PDF written from a report without findings. It is what the
Claimant hands to McSCert's administration, and the only thing that counts
once the report is done: it stands alone, read with any PDF reader.

## Order

1. The **cover**, on one page or more.
2. One **section** per kind of document that the report holds, in the order
   of the kinds: event documents, receipts, missing receipt authorizations,
   boarding passes, bank statements, notes. A kind without documents has no
   section.

Each section is its section page, then its documents, one after the other.

| Section | Order of its documents |
|---|---|
| Receipts, missing receipt authorizations, bank statements | By the number of the first expense they support, then in the order they were added. |
| Event documents, boarding passes, notes | In the order they were added. |

A document's label is the letter of its kind and its rank in its section:
R1, R2, and so on.

## Pages

- Generated pages (cover, section pages) are US Letter, portrait, with
  three-quarter-inch margins.
- A PDF document keeps every page as it is: size, orientation and content.
- An image document is placed on a Letter page of its own, portrait or
  landscape to match the image, scaled down to fit the margins and never
  enlarged.

## Cover

The cover takes the place of the McSCert Expense Report Template: it carries
the template's fields and its table, so that nothing else needs filling in.

- **Heading.** The McSCert logo, then *McSCert Expense Report*, and the date
  the document was written.
- **Report fields.** Name of claimant, position or title, event, dates of the
  event, accounts. When the report suggests no account, the Accounts line is
  left blank for McSCert's administration.
- **Attached information.** The six kinds of document, in their order, each
  with a box ticked when its section exists and the labels it holds (R1–R7).
- **Expenses.** A table of every expense, sorted by date then in the order
  they were added, and numbered in that order:

  | # | Date | Description | Foreign amount | Claimed (CAD) | Supporting documents |
  |---|---|---|---|---|---|
  | 1 | 2026-10-03 | Air Canada, YYZ–CDG return | EUR 640.00 | $1,012.35 | R1, S1 |

  The foreign amount is the currency code then the amount, empty for an
  expense paid in Canadian dollars. The supporting documents are labels, in
  the order of the report document. The table continues on the next page
  when it does not fit, its header repeated; a last row gives the total of
  the claimed amounts.

The template's exchange-rate column has no counterpart: every expense has a
bank statement, which supports its claimed amount.

## Section page

The title of the section, then a table of its documents:

| Label | File | Pages | Expenses |
|---|---|---|---|
| S1 | statement-october.pdf | 9–11 | 1, 2, 4 |

Pages are the pages of the report document. The Expenses column is left out
of the sections whose documents no expense refers to.

## Stamp

Every page carries a stamp in its bottom margin, on the right, written so that
it reads upright on screen, whatever the page's size and rotation:

- on a page of a document: its label, then the page number out of the total,
  as in `R3 · 12 / 30`;
- on the cover and on section pages: the page number out of the total.

The stamp is what lets a reader of a printed copy go from the cover to a
receipt and back.

## Text

Text is written in Helvetica, the PDF standard font, which covers the Latin
alphabet with its accents and common punctuation (the Windows-1252 character
set). Texts are compared in their composed form, so that an accent typed as a
separate mark, as file names on macOS are, counts as the accented letter. A
text holding another character, file names included, is a finding at the
Review step (`prepare-an-expense-report.md`); it is never replaced silently.

## Look

The colours are those of the McMaster palette: maroon titles and table
headers, grey secondary text, Dundurn Grey rules. The logo is the McSCert
logo, in colour, as supplied.

## Properties

The document's title is *McSCert Expense Report — <event>*, its author the
claimant, and its creator *McSCert Expense Report vX.Y.Z*, the version of the
system that wrote it.
