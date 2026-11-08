# ADR 0010: The report document takes the place of the McSCert template and its attachments

- **Status:** Accepted
- **Date:** 2026-11-08
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

Options considered for the pages of the documents added, which come in every
size (A4 invoices, Letter statements, narrow till receipts, phone photos):

- **Keep each page's size.** Nothing is scaled, but the report document mixes
  sizes, prints unevenly, and the stamp is written over the bottom of the
  page's content.
- **Draw each page as an object on a new Letter page** (pdf-lib's
  `embedPage`). Uniform, but the page's links and form fields are dropped,
  and its text sits inside an object a PDF reader's redaction tool may not
  reach.
- **Scale each page in place onto a Letter box**: its content and
  annotations scaled down, the page's boxes set to Letter around them,
  clipped to what its crop box showed. Uniform, and the page stays a page.
  Fitted within margins, the stamp never covers it, but every page shrinks,
  a Letter page to 82 %; fitted to the whole page, a Letter page stays as it
  is and an A4 page is shown at 94 %.

Options considered for a missing receipt:

- **The Claimant fills in McMaster's form** and adds it as a document. Retypes
  what the report already knows: date, amount, description, name, title.
- **The system writes the form**, filled in from the report, and the Claimant
  signs it. McMaster's form is not a fillable PDF, so the system reproduces
  its wording and layout.

A business travel claims its meals as per diems, at a rate per meal, in
Canadian dollars for a domestic meal and in US dollars for an international
one, without receipts. A day's meals, and a travel's, are most often all
domestic or all international, but a day of travel can be both. Options
considered for the per diems on the cover:

- **One row for the whole travel**, its total by currency. Short, but the
  administration cannot see which meals of which day were claimed, nor enter
  them day by day.
- **One row per day**, as an expense: its meals claimed and its amount, the
  meals not claimed and their reasons under it, an Entered box of its own. A
  day of domestic and international meals has an amount in each currency on
  one row.
- **One row per day and currency**: as one row per day, a day of domestic
  and international meals taking two rows, each in one currency as every
  expense's row is.

## Decision

The report document is written as `docs/specs/report-document.md` says:

- **A cover** that carries every field of the template and its table, and so
  replaces it, with the claimant's email and, for a student or a postdoctoral
  fellow, the name and email of their supervisor, for a visitor those of their
  host, so that the administration can reach them. The template's event is
  the report's **purpose**, and only a **business travel** has dates: not
  every report is for an event. The foreign amount is shown for information; there is no
  exchange-rate column and nothing is converted: the system does not deal
  with exchange rates.
- **Four kinds of document**, each a section opened by a **section page** that
  lists its documents with their pages and the expenses they support:
  additional documents, receipts, missing receipt authorizations, bank
  statements. Additional documents come first, the travel justifications of
  a business travel first among them: a business travel is reimbursed only
  once it is justified, so the administration reads why the claimant
  travelled before what it cost. Bank statements come last: one often
  supports every expense, and it is read against the receipts before it.
  Receipts and bank statements are added from the expenses they support;
  additional documents (invitation, conference programme, itinerary,
  boarding passes, notes) from the report.
- **A document has a name**, its file name without its extension unless the
  Claimant gives it another, so that the cover and the section pages call it
  what a reader recognizes (*Visa, October*) rather than what a bank or a
  browser called the file.
- **A missing receipt authorization per expense without a receipt**, written
  by the system in McMaster's wording, filled in from the expense and the
  report, its signature line left blank. The Claimant signs the saved report
  document, on paper or with a PDF reader.
- **A per diem is one row of the cover per day and currency with a meal
  claimed**, among the expenses by date and numbered with them, its meals
  not claimed and their reasons on the line where an expense's documents
  would be, so that the administration sees what was claimed and what was
  not. Each meal is domestic or international, set for the whole travel or
  a day at once; the amount of international meals is in US dollars, in the
  foreign amount column, and stays unconverted. A day with no meal claimed claims nothing
  and has no row. The rates are the system's, configured in
  `config/per-diems.json`, one per meal for domestic and for international
  meals, and built into the system: a claimant cannot change them.
- **An expense paid in cash** has no bank statement; the cover says *cash*
  where its statement's label would be.
- **The cover's table names each expense's documents**, on a line under the
  expense, and gives each expense an **Entered** box, a form field the administration
  ticks on screen or by hand on paper as it enters the expense in McMaster's
  system: it shows at a glance what is left to enter.
- **Every page is US Letter.** A page of a PDF document is scaled down in
  place to fit a Letter page when it is larger, never enlarged, and centred,
  so that the report document prints evenly and each page stays as close to
  its own size as it can: a document is read at the size it was written. An
  image, whose size in pixels says nothing of its size on paper, is fitted
  within the margins, so that the stamp never covers it. A JPEG photo is
  turned, and mirrored, as its Exif orientation says first: phones store a
  photo as the camera held it and note how to turn it, which the PDF library
  does not read.
- **A label per document** (R3), used on section pages and in the **stamp**
  on every page with the numbers of the expenses the document supports and
  the page number out of the total, so that a printed copy can be followed
  from a row to its pages and back, and every page says which expenses it is
  for.
- **Labels, documents' names and expenses are links**, so that on screen a
  click goes from a row of the cover to its document, and from a page of a
  document, or its row on a section page, back to the rows of the expenses
  it supports. A section page names an expense by its description, which a
  reader recognizes, rather than by its number.
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

- A page larger than Letter is shown smaller: an A4 invoice at 94 % of its
  size. A small receipt sits in the middle of a Letter page, mostly white.
- The stamp is written in the bottom margin of a PDF page, over its content
  when the content reaches that far.
- An image is written smaller than it was added (ADR 0011): a report of many
  phone photos still weighs several megabytes.

- The cover is not the template itself, and the missing receipt authorization
  is a reproduction of McMaster's form. If the administration requires the
  official documents, this ADR is amended.
- When McMaster changes the wording of its form, the system changes with it.
- When McSCert changes its per diem rates, `config/per-diems.json` changes
  and a new version is released; a report document keeps the rates of the
  version that wrote it.
- A report document with a missing receipt authorization is not complete until
  the Claimant has signed it.

## Compliance

A change is compliant with this ADR when:

- the report document follows `docs/specs/report-document.md`, and a change to
  its layout or to the wording of the missing receipt authorization changes
  that spec in the same commit;
- the per diem rates are in `config/per-diems.json` only, which the system
  reads when it is built and refuses unless it holds a rate for each meal,
  domestic and international;
- tests read the written report document back and check its order, its pages,
  its labels, its names, its stamps, the target of each link, the Entered box
  of each expense, the size and turn of each page, and the fields of each
  missing receipt authorization.
