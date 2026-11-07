# Report Document

The single PDF written from a report without findings. It is what the
Claimant hands to McSCert's administration, and the only thing that counts
once the report is done: it stands alone, read with any PDF reader.

## Order

1. The **cover**, on one page or more.
2. One **section** per kind of document the report holds, in the order of the
   kinds: additional documents, receipts, missing receipt authorizations,
   bank statements. A kind without documents has no section.

Each section is its section page, on one page or more, then its documents,
one after the other.

| Section | Order of its documents |
|---|---|
| Receipts, bank statements | By the number of the first expense they support, then in the order they were added. |
| Missing receipt authorizations | By the number of their expense. |
| Additional documents | The travel justifications, then the others, each in the order they were added. |

A document's label is the letter of its kind and its rank in its section:
R1, R2, and so on.

## Pages

- Every page of the report document is US Letter, and shows portrait. A page
  that would show wider than tall is turned a quarter, the top of its content
  to the left, as a landscape page is printed.
- Generated pages (cover, section pages, missing receipt authorizations)
  have three-quarter-inch margins. A text wraps within its column or its
  line, never clipped; what does not fit a page continues on the next one, as
  each part below says.
- Each page of a PDF document is placed on a Letter page, across the page
  when it shows wider than tall, as close to its own size as it can be:
  scaled down to fit the page when it is larger, never enlarged, and centred.
  A Letter page stays as it is; an A4 page is shown at 94 %. It keeps its
  text, its links and its form fields; what its crop box hid stays hidden.
- An image document is placed on a Letter page of its own, across the page
  when it is wider than tall: scaled down to fit the three-quarter-inch
  margins when it is larger, never enlarged, and centred.
- A JPEG image is first turned as its Exif orientation says, so that a photo
  taken with a phone shows upright.

## Cover

The cover takes the place of the McSCert Expense Report Template: it carries
the template's fields and its table, so that nothing else needs filling in.

- **Heading.** The McSCert logo on the left; in the top right corner, level
  with it, *McSCert Expense Report*, and under it the date the document was
  written.
- **Report fields.** Name of claimant, position, email, then the supervisor
  and their email for a student or a postdoctoral fellow, the host and their
  email for a visitor; purpose, the dates of a business travel, account.
- **Attached information.** The four kinds of document, in alphabetical
  order, each with a box ticked when its section exists.
- **Expenses.** A table of every expense, sorted by date then in the order
  they were added, and numbered in that order:

  | # | Date | Description | Foreign amount | Claimed (CAD) | Supporting documents | Entered |
  |---|---|---|---|---|---|---|
  | 1 | 2026-10-03 | Air Canada, YYZ–CDG return | EUR 640.00 | $1,012.35 | Air Canada booking<br>Visa, October | ☐ |
  | 2 | 2026-10-05 | Taxi, CDG–hotel | EUR 55.00 | $87.10 | Taxi, CDG–hotel<br>cash | ☐ |

  The foreign amount is the currency code then the amount, empty for an
  expense paid in Canadian dollars; it is for information, nothing is
  converted. The supporting documents are the names of the expense's
  documents, one per line, in the order of the report document, and *cash*
  for an expense paid in cash; a missing receipt authorization is named by
  the expense's description. *Entered* is an empty box, a form field that
  McSCert's administrative staff tick on screen, or by hand on a printed
  copy, once they have entered the expense. The table continues on the next
  page when it does not fit, its header repeated; a last row gives the total
  of the claimed amounts, without a box.

The template's exchange-rate column has no counterpart: the system does not
deal with exchange rates.

## Section page

The title of the section, then a table of its documents:

| Label | Name | Pages | Expenses |
|---|---|---|---|
| S1 | Visa, October | 9–11 | 1, 3, 4 |

Pages are the pages of the report document. Missing receipt authorizations
have no name: the column shows the expense's description. The Expenses column
is left out of the section of additional documents. Of a business travel,
that section page splits its table in two subsections, each under its
subheading and with its own header: *Travel justifications*, then
*Other documents*; a subsection without documents is left out. The
labels run on from one to the other.

The table continues on the next page when it does not fit, its header
repeated, as the cover's does. Those pages are all section pages: each is
stamped as one, and the section's documents start after the last of them.

## Missing receipt authorization

One per expense with a missing receipt, which reproduces McMaster's Missing
Receipt Authorization Form, filled in, on one page when it fits. Under the
McSCert logo:

> **Missing Receipt Authorization Form**
>
> **Original invoices** on company letterhead or official receipts are
> required for reimbursements. Where the original invoice or receipt is not
> issued or lost, then a copy of the official invoice or receipt or a credit
> card statement will be accepted as a substitute with a brief explanation and
> notation of "original lost" clearly indicated on the substituting support.
>
> **EXPLANATORY NOTE**
>
> Please accept this as proof of expenditure for the missing **original**
> receipt.

Then the fields, each on its line:

| Field | Written |
|---|---|
| Reason for missing original receipt or boarding pass(es) | The expense's reason |
| Paid to | The expense's *paid to* |
| Dated | The expense's date |
| Amount | The claimed amount; for an expense paid in another currency, the foreign amount follows in parentheses |
| Description of Expense(s) | The expense's description |

Then, in bold: *I certify that this expense has not and will not be claimed
for reimbursement from other sources or institutions.* and the lines
*Signature of Claimant* (left blank), *Printed Name* (the claimant), *Title*
(the position), *Extension* (from the report, blank when not given) and
*Email* (the claimant's).

A field's value wraps over as many lines as it needs: a reason, a payee or a
description, a long list of meal attendees included, is never cut. When the
form no longer fits a page, it continues on the next one, and the
certification and the signature lines stay together on its last page, so
that what is signed is under the signature. The form's label and stamp cover
all its pages.

## Stamp

Every page carries a stamp in its bottom margin, on the right, written so that
it reads upright on screen, whatever the page's size and rotation:

- on a page of a receipt, a bank statement or a missing receipt
  authorization: its label, each expense the document supports, by its
  number and the start of its description, then the page number out of the
  total, as in `R3 · Expense 2: Taxi, CDG–hotel · 12 / 30` or
  `S1 · Expense 1: Air Canada, YYZ–CDG return · Expense 3: Dinner with the
  programme comm… · 14 / 30`. A description longer than 30 characters is cut
  to its first 30, followed by an ellipsis;
- on a page of an additional document: its label, then the page number out
  of the total, as in `A1 · 3 / 30`;
- on the cover and on section pages: the page number out of the total.

Every page of a document carries the expenses, not only its first. When the
stamp is wider than the page less its margins, the expenses go on lines of
their own above it, as many as they need, an expense wrapping over several
lines when it is wider still, each of them a link.

The stamp is what lets a reader of a printed copy go from the cover to a
receipt and back.

## Links

Labels and expense numbers are links: clicked in a PDF reader, they go to
what they name.

| Where | Link | Goes to |
|---|---|---|
| Cover, expenses | A name among the supporting documents | The first page of its document |
| Section page | A label, or its pages | The first page of its document |
| Section page | An expense number | The expense's row on the cover |
| Stamp | An expense, its number and its description | The expense's row on the cover |
| Stamp | The label | The document's row on its section page |

Going to a row opens the page that holds it, with the row at the top of the
window. *cash* and page numbers in the stamp are not links. A link changes
nothing on a printed copy, where the stamp does its work.

## Text

Text is written in Noto Sans, regular and bold, embedded in the report
document. It covers every language written in the Latin alphabet, Greek and
Cyrillic. Texts are compared in their composed form, so that an accent typed as
a separate mark, as file names on macOS are, counts as the accented letter. A
text holding a character the font does not have (Chinese, Japanese, emoji),
names included, is a finding at the Review step
(`prepare-an-expense-report.md`); it is never replaced silently.

## Look

The colours are those of the McMaster palette: maroon titles and table
headers, grey secondary text, Dundurn Grey rules. The logo is the McSCert
logo, in colour, as supplied, on the cover, on section pages and on missing
receipt authorizations.

## Properties

The document's title is *McSCert Expense Report — <purpose>*, its author the
claimant, and its creator *McSCert Expense Report vX.Y.Z*, the version of the
system that wrote it.
