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
  text, its links and its form fields; what its crop box hid stays hidden. It
  leaves out what no reader shows: its thumbnail, the private data of the editor
  that wrote it, its metadata, and the Exif data of its JPEG images.
- An image document is placed on a Letter page of its own, across the page
  when it is wider than tall: scaled down to fit the three-quarter-inch
  margins when it is larger, never enlarged, and centred.
- A JPEG image is first mirrored and turned as its Exif orientation says, so
  that a photo taken with a phone shows upright.
- An image document keeps its pixels as added, whatever its size, unless the
  Claimant reduced it (`prepare-an-expense-report.md`). Reduced, its long side is
  at most 2200 pixels, never enlarged: a JPEG is encoded at quality 0.8; a PNG stays
  a PNG unless that is more than twice the size of the same image as a JPEG, a
  transparent background becoming white.
- A JPEG image holds its image and its colour profile only, without the Exif
  data of a photo.
- A PDF document the Claimant reduced (`prepare-an-expense-report.md`) has the
  same pages, text, links and form fields. Each JPEG in RGB, by a colour profile
  or not, or in plain grey, without a mask or decoding parameters, with a long
  side above 2200 pixels is encoded at that size and quality, an RGB one keeping its
  colour space. A shape filled and drawn more than once is kept once and drawn
  from there, within 0.01 point of where it was, unless the document is a bank
  statement. A page holding an inline image, a page with a string running from one
  of its content streams into the next, a page its unit enlarges, a shape
  under a transform that enlarges, a shape filled with a pattern, a shape in a
  path another operator interrupts and a shape in a text object stay as they are.

## Cover

The cover takes the place of the McSCert Expense Report Template: it carries
the template's fields and its table, so that nothing else needs filling in.

- **Heading.** The McSCert logo on the left; in the top right corner, level
  with it, *McSCert Expense Report*, and under it the date the document was
  written.
- **Report fields.** Purpose first, with the dates and the locations of a
  business travel; then name of claimant, position, email, the supervisor
  and their email for a student or a postdoctoral fellow, the host and their
  email for a visitor; then the account, its name followed by its code in
  parentheses when it is given (*NSERC Discovery (20-123-456)*).
- **Attached information.** The four kinds of document, in alphabetical
  order, each with a box ticked when its section exists.
- **Policy.** Beside the attached information, level with it and against the
  right margin: its heading, then the name of each document `config/policy.json`
  lists, one per line, each a link followed by its arrow. A longer name wraps, clear
  of the attached information, and the expenses start under the longer of the two.
  A policy that does not fit a page stands under the attached information instead,
  and continues on the next page.
- **Expenses.** A table of every expense and every per diem with a meal
  claimed, sorted by date, the expenses of a day in the order they were
  added and its per diem after them, and numbered in that order, each on two
  lines: its fields, then, under its description, its supporting documents,
  or the meals of a per diem not claimed. A per diem whose meals claimed are
  domestic and international takes two rows, its domestic meals then its
  international ones.

  | # | Date | Description | Foreign amount | Claimed<br>(CAD) | Entered<br>(Mosaic) |
  |---|---|---|---|---|---|
  | 1 | 2026-10-03 | Air Canada, YYZ–CDG return | EUR 640.00 | $1,012.35 | ☐ |
  | | | *Receipt ↗ · Statement ↗* | | | |
  | 2 | 2026-10-05 | Taxi, CDG–hotel | EUR 55.00 | | ☐ |
  | | | *Receipt ↗ · Paid in cash* | | | |
  | 3 | 2026-10-05 | Per diem, international: breakfast, dinner | USD 86.10 | | ☐ |
  | | | *Not claimed: lunch (provided by the conference)* | | | |
  | 4 | 2026-10-06 | Per diem, domestic: breakfast, lunch | | $55.80 | ☐ |
  | | | | | | |
  | 5 | 2026-10-06 | Per diem, international: dinner | USD 57.70 | | ☐ |
  | | | **Total** | | **CAD 1,068.15**<br>**EUR 55.00**<br>**USD 143.80** | |

  The titles *Claimed (CAD)* and *Entered (Mosaic)* each stand on two lines,
  centred in their columns. An amount is always written with two decimals, as
  *$10.00*. The claimed amounts stand on the right of their column, ending with
  those of the total. A description keeps its line breaks. The foreign amount is the currency
  code then the amount, empty for an expense paid in Canadian dollars;
  nothing is converted. The claimed amount is empty for an expense that has
  none, McSCert working it out from the foreign amount. The supporting documents are
  the expense's documents, in grey, separated by a middle dot, in the order of
  the report document, each called by its kind whatever its name, *Receipt*,
  *Missing receipt* or *Statement*, followed by the arrow of a link, and *Paid in
  cash* for an expense paid in cash. They run from under
  the description to the claimed amount, and on to the next line when they
  do not fit. *Entered* is an empty box, a form field that McSCert's
  administrative staff tick on screen, or by hand on a printed copy, once
  they have entered the expense. The table continues on the next page when
  it does not fit, its header repeated, an expense starting on the page its
  documents start on; a last row gives the total, without a box: the sum
  of the claimed amounts and of the domestic meals claimed, when there is
  one, then, one per line and by currency in alphabetical order, the sum of
  the foreign amounts of the expenses without a claimed amount, US dollars
  including the international meals claimed. Each line is the currency's code
  then the amount, CAD included, the codes aligned on the left of the column
  and the amounts on its right. A total that does not fit a page continues on the
  next.

  A per diem row's description is *Per diem*, *domestic* or *international*,
  then its meals claimed, in the order breakfast, lunch, dinner. Its amount
  is the sum of their rates: of domestic meals, its claimed amount; of
  international ones, its foreign amount, in US dollars, without a claimed
  amount. Under the day's last row, in grey, *Not claimed:* and its other
  meals, each followed by its reason in parentheses when it has one; nothing
  when every meal is claimed. A per diem is supported by no document: no section page
  and no stamp names it, and its number is never a link.

The template's exchange-rate column has no counterpart: the system does not
deal with exchange rates.

## Section page

The title of the section, then a table of its documents:

| Label | Name | Pages | Expenses |
|---|---|---|---|
| S1 ↗ | Visa, October | 9–11 | Air Canada, YYZ–CDG return ↗<br>Taxi, CDG–hotel ↗<br>Dinner with the programme comm… ↗ |

Pages are the pages of the report document. The expenses a document
supports are named by their description, one per line, a description longer
than 30 characters cut to its first 30 followed by an ellipsis, as in the
stamp. Missing receipt authorizations
have no name: the column, headed *Payee*, shows who was paid, and the Expenses
column names the expense, as for any other document. The Expenses column
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
Receipt Authorization Form, filled in, on one page when it fits. Its text and
lines are black. A frame runs across the page, within its margins, and rules
across the frame divide it in four parts. On one page, the frame runs down to the
bottom margin, the height left over shared among the gaps and the lines:

1. The McMaster logo, on the left; level with its bottom, centred, bold and
   underlined, *Missing Receipt Authorization Form*; then, justified:

   > **Original invoices** on company letterhead or official receipts are
   > required for reimbursements. Where the original invoice or receipt is not
   > issued or lost, then a copy of the official invoice or receipt or a credit
   > card statement will be accepted as a substitute with a brief explanation and
   > notation of "original lost" clearly indicated on the substituting support.

2. Centred and bold, *EXPLANATORY NOTE*; then:

   > Please accept this as proof of expenditure for the missing **original**
   > receipt.

   Then *Reason for missing original receipt or boarding pass(es):*, and its
   lines.
3. *Paid to:*, then *Dated:* and *Amount:* on one line, then *Description of
   Expense(s):*, its first line next to it.
4. In bold: *I certify that this expense has not and will not be claimed for
   reimbursement from other sources or institutions.* Then *Signature of
   Claimant:*, *Printed Name:* and *Title:*, their names ending at the same
   place, then *Extension:* and *Email:* on one line.

| Field | Written | Lines, at least |
|---|---|---|
| Reason for missing original receipt or boarding pass(es) | The expense's reason | 5, across the frame |
| Paid to | The expense's *paid to* | 1 |
| Dated | The expense's date | 1 |
| Amount | The claimed amount; for an expense paid in another currency, the foreign amount follows in parentheses, or stands alone when the expense has no claimed amount; each names its currency, as *CAD 55.00 (EUR 35.00)* | 1 |
| Description of Expense(s) | The expense's description | One next to its name, then 3 across the frame |
| Signature of Claimant | Left blank | 1 |
| Printed Name | The claimant | 1 |
| Title | The expense's job title | 1 |
| Extension | The expense's phone extension, blank when not given; a short line, the email taking the rest | 1 |
| Email | The claimant's | 1 |

Each value is written in bold, standing on a line drawn to the end of its place. A
line a value leaves empty is still drawn.

A field's value wraps over as many lines as it needs: a reason, a payee or a
description, a long list of meal attendees included, is never cut. When the
form no longer fits a page, its frame closes there and it continues on the next
one in a frame of its own, and the
certification and the signature lines stay together on its last page, so
that what is signed is under the signature. The form's label and stamp cover
all its pages.

## Stamp

Every page carries a stamp in its bottom margin, on the right, written so that
it reads upright on screen, whatever the page's size and rotation:

- on a page of a receipt, a bank statement or a missing receipt
  authorization: its label, each expense the document supports, by its
  number and the start of its description, then the page number out of the
  total, as in `R3 · Expense 2: Taxi, CDG–hotel ↗ · 12 / 30` or
  `S1 · Expense 1: Air Canada, YYZ–CDG return ↗ · Expense 3: Dinner with the
  programme comm… ↗ · 14 / 30`. A description is written on one line, its line
  breaks as spaces, and one longer than 30 characters is cut to its first 30,
  followed by an ellipsis;
- on a page of an additional document: its label, its name, then the page
  number out of the total, as in `A1 ↗ · Invitation from ICSE · 3 / 30`; a
  name longer than 30 characters is cut as a description is;
- on the cover and on section pages: the page number out of the total.

Every page of a document carries the expenses, not only its first. When the
stamp is wider than the page less its margins, the expenses go on lines of
their own above it, as many as they need, an expense wrapping over several
lines when it is wider still, each of them a link.

The stamp is what lets a reader of a printed copy go from the cover to a
receipt and back.

## Links

Labels and expense numbers are links: clicked in a PDF reader, they go to
what they name. An arrow pointing up and to the right, drawn after a link in the
colour of its text, shows that it is one; a section page's pages have none, the
label of their row already showing where they go.

| Where | Link | Goes to |
|---|---|---|
| Cover, expenses | A document among the supporting documents | The first page of its document |
| Section page | A label, or its pages | The first page of its document |
| Section page | An expense's description | The expense's row on the cover |
| Cover, Policy | The name of a document | The address `config/policy.json` gives it, opened as the PDF reader opens a link |
| Stamp | An expense, its number and its description | The expense's row on the cover |
| Stamp | The label of an additional document, which has no expense to go back to | The document's row on its section page |

Going to a row opens the page that holds it, with the row at the top of the
window. *Paid in cash*, a document's name and page numbers in the stamp are not links. A link changes
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
headers, grey secondary text and rules. The logo is the McSCert
logo, in colour, as supplied, on the cover and on section pages. A missing
receipt authorization, as McMaster's form, is black, under the McMaster logo, in
colour.

## Properties

The document's title is *McSCert Expense Report — <purpose>*, its author the
claimant, and its creator *McSCert Expense Report vX.Y.Z*, the version of the
system that wrote it.
