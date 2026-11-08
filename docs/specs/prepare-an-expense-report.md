# Prepare an Expense Report

What the Claimant does, step by step, and what the system checks at each
step. The terms are those of `domain-model.md`.

## Opening the system

The system is one HTML file the Claimant opens in their browser, from their
computer. When the browser kept a draft, the system opens on it, at the
Report step; otherwise it opens on an empty report.

When the browser refuses to keep a draft, the system says so on every step:
closing the page will lose the report. Everything else works.

Under every step, the footer names the system and its version, McSCert and
McMaster University, and states: *Everything you enter and add stays in this
browser, on this computer. Nothing is collected, sent or shared.*

**New report** is offered on every step. It asks for confirmation, in a
dialog over the step as every confirmation is, then
discards the draft, its expenses and its documents, and opens the Report step
on a report holding only the name of claimant, position and email, kept as
the new draft. When the browser does not delete the draft, the report
stays as it is and the system says so, so that the Claimant can try again.

## The steps

The steps follow one another; Back returns to the previous one, and the
stepper lets the Claimant go back to any step already reached. Every change is
kept in the draft as soon as it is made, incomplete as it may be: a required
field left empty, an expense whose receipt is still to come. A required
field is marked with an asterisk (*) next to its name; what it needs besides
being filled in is shown next to it. A value typed that does not follow its
field's rule is shown with that rule, and kept once it does.

### 1. Report

The fields are grouped in sections: **Claimant** (name of claimant, position,
email), **Supervisor** or **Host** when the position asks for one,
**Purpose** (purpose, business travel, its first and last day and its
locations) and
**Account**.

| Field | Rule |
|---|---|
| Name of claimant | Required. |
| Position | Required, one of Faculty, Postdoctoral fellow, Student, Staff, Visitor. |
| Email | Required, an email address. |
| Extension | Optional. Written on missing receipt authorizations. |
| Supervisor, supervisor's email | Asked of a Student or a Postdoctoral fellow, and then required: the supervisor's name, and an email address. |
| Host, host's email | Asked of a Visitor, and then required: the host's name, and an email address. |
| Purpose | Required. |
| Business travel | Ticked for a report whose purpose took the claimant away. Unticked, the report has no dates. |
| First day | Asked of a business travel, and then required: a calendar date. |
| Last day | Asked of a business travel, and then required: a calendar date, not before the first day. |
| Location(s) | Asked of a business travel, and then required: where it took the claimant, as free text. |
| Account | Required, free text. |

Choosing another position takes the supervisor or the host out of the
report; unticking business travel takes the dates, the locations, the per
diems and the travel justifications out. Changing the dates takes out the per
diems of the days no longer between them. Continue is offered once every required field is valid.

### 2. Expenses

The expenses, sorted by date, then in the order they were added. Each shows
its date, its description, its foreign amount, its claimed amount, its
receipt or that its receipt is missing, its bank statement or that it was
paid in cash, and, in red, what it still lacks: a required field, or a
document whose name a document before it already has. A document's name opens the
document in a new tab of the browser. Each has **Change**, a pen, and
**Remove**, a trash can. **Add an expense** stands above them, and, for a
business travel whose dates are valid, **Manage per diems**, next to it.
When a meal is claimed, the per diems stand above the expenses: on one line,
the number of days with a meal claimed and their total, in Canadian dollars
then in US dollars; then each of those days, by date, as on the cover of the
report document: its meals claimed, domestic then international, then its
meals not claimed and their reasons, without their amounts.

**Add an expense** adds an empty expense to the report and opens its fields;
**Change** opens the fields of an expense, filled in. Every change is kept as
it is typed, as on any step. While they are open, Continue is not offered:
**Done** closes them and shows the expenses. Leaving the step closes them
too. **Discard** closes them and undoes every change made since they
opened: an expense just added leaves the report, an expense changed is as it
was, its documents and their names included. A value typed that breaks its
rule, which the expense does not keep, stays shown with its rule, and holds
Done, Back and the other steps until it follows the rule or is cleared, or
the expense is discarded.

| Field | Rule |
|---|---|
| Date | Required, a calendar date. It may fall outside the dates of the report. |
| Description | Required. For a meal not only for the Claimant, it lists the attendees and their affiliations. It may run over several lines: its line breaks are kept on the Review step and in the report document. |
| Claimed amount (CAD) | Required, in Canadian dollars, more than zero, at most two decimals. Optional for an expense paid in another currency, McSCert then working it out. |
| Paid in another currency | Optional. When ticked: **Foreign amount**, more than zero, at most two decimals, and **Currency**, a three-letter ISO 4217 code other than CAD, its name shown
under it, are required. Unticked, the expense has neither. |
| Receipt | One, unless the receipt is missing. |
| I don't have the receipt | When ticked: the expense has no receipt, and two more fields are required: **Paid to**, who was paid, and **Reason**, why the receipt is missing. |
| Paid in cash | When ticked: the expense has no bank statement. |
| Bank statement | One, unless the expense was paid in cash. |

A receipt or a bank statement is added from the expense, dropped on the zone
of its kind or chosen from the computer, or chosen among the receipts or bank
statements already in the report. The same document may be chosen by
several expenses. The trash can next to it takes it out of this expense
only.

**Remove** asks for confirmation, naming the receipt and the bank statement
that leave the report with the expense. Removing an expense, or a document
from an expense, takes out of the report any receipt or bank statement no
expense refers to any more.

**Manage per diems** opens the per diems of the business travel, one card
per day, from its first day to its last, each under its day of the week and
its date: domestic, international or per meal, then its three meals, each
a toggle pressed when claimed, then the reasons of its meals not claimed.
**Per meal** shows domestic or international under each of its meals; a
card whose meals differ has Per meal chosen. As with an expense's fields, Continue is
not offered while they are open, and **Done** closes them.

| Field | Rule |
|---|---|
| Domestic, international | One of them, for each meal. A meal starts domestic. Chosen for a day, it is for its three meals; while they differ, the day shows Per meal. **All domestic** and **All international**, above the days, set every meal at once, and every day to Domestic or International, a day on Per meal included. |
| Breakfast, lunch, dinner | Each ticked when claimed, at its rate, as `config/per-diems.json` sets it: in Canadian dollars for a domestic meal, in US dollars for an international one. A per diem starts with no meal claimed. The rates and the amounts are not shown here: the line above the expenses, the Review step and the report document give them. |
| Reason | Optional, for a meal not claimed of a day with a meal claimed: why it is not, as *provided by the conference*. **Add a reason for not claiming lunch (optional)**, under the meals, opens the field of that meal, *Reason for not claiming lunch (optional)*; a reason given stays shown in it. A day without a meal claimed asks for none: the report document leaves it out. Ticking the meal takes its reason out. |

Continue is offered once there is at least one expense or a meal claimed,
and every expense follows the rules above.

### 3. Additional documents

The travel justifications of a business travel, then the additional
documents, each with its name, its file name and its number of pages. The
Claimant adds and removes them, dropped on the zone of their kind or chosen
from the computer.

| Field | Rule |
|---|---|
| Travel justification(s) | Asked of a business travel, and then at least one: an invitation letter, a conference programme, an acceptance notification. |
| Additional document(s) | Optional, as many as needed: an itinerary, a poster, boarding passes, notes. |

Continue is offered once a business travel has a travel justification.

### Adding a file

On the Expenses and Additional documents steps, a file is added when it is a
PDF, a JPEG image or a PNG image, whatever its name says. It is refused, with the reason, when it is:

- of another format;
- damaged, or a PDF without pages;
- a PDF protected by a password.

A file already in the report, with the same content, is not added twice. Added
from an expense as a receipt or a bank statement when it is already a
document of that same kind, the document already there is chosen, and the
step says so under it: *Already in the report, as <name>: chosen.* Otherwise,
already a document of another kind or added again as a travel justification
or an additional document, it is refused, naming the document it already is,
by its kind and its name: a document has one kind. Adding several files at
once, dropped or chosen together, handles each on its own, in the order
given; where a field takes one document, the first is added, and a document
there already is replaced only once it is removed.

Files are read in the browser, which may take a while for a large one. While
a file is being added, Continue and the steps ahead are not offered: the
report is not reviewed, nor saved, without it. Nor are Done, Discard and
Remove on the Expenses step: the file goes to the expense it was added to.

### Naming a document

A document added takes its file name, without its extension (`.pdf`,
`.jpeg`, `.png`), as its name. Next to it, its **Name** is a field the
Claimant may change at any time, on the step it was added from: an invoice,
a statement or a programme named as the Claimant calls it. A name left empty
is the file name without its extension again. The name is what the Review
step and the report document call the document.

No two documents of the report have the same name, whatever its case. A
document added whose name another document already has is named after it,
followed by (2), (3) and so on. Nothing is shown under a name, unless a
document before it, in the order of the steps, already has it: the error
*Another document already has this name.* is then shown under it, and
Continue is not offered.

### 4. Review

The report as it will be written: the cover, with the table of the
expenses, each on two lines as in the report document; the per diems, under
their own heading, one row per day with a meal claimed, with its numbers on
the cover, its date, domestic, international or both, each meal claimed with
its rate in its currency or not claimed with its reason, and the day's
total, one amount per currency; then the total of the report, as on the
cover of the report document; then each section with its documents, their labels and their names, every table
of documents spaced alike. A document's name opens the document in a new
tab of the browser, from the file the Claimant added. The Entered boxes are
the report document's alone. Then the findings, if any.

| Finding | Wording |
|---|---|
| A required field of the Report step is missing or invalid | The field, and what it needs. |
| No expense, and no meal claimed | No expense or per diem is claimed. |
| An expense breaks a rule of the Expenses step | The expense, by its date and description, and the rule. |
| A business travel has no travel justification | At least one travel justification is required. |
| A document has the name of a document before it | The document, by its file name, and its name. |
| A text holds a character the report document cannot write | The field, the expense or the per diem when it is one, and the character. For a name: the document, by its kind and file name. |

**Save the report** is offered when there is no finding. It writes the report
document (`report-document.md`) and hands it to the browser to be saved as
`expense-report-<date>-<claimant>.pdf`: the date is the first day of a
business travel, or the date of the earliest expense of another report; the
name of the claimant in lower case, without accents, words joined by
hyphens. The browser does not tell the system whether it wrote the file or
the Claimant cancelled, so the step says the report document was handed to
the browser, with its file name, and keeps Save the report on offer to hand
it over again. It also says that each missing receipt authorization, when
there is one, is to be signed, and that the draft, bank statements included,
stays in this browser until New report. What it says holds for the report
as saved: once the report changes, it is no longer said.

When the report document cannot be written, the step says so, and that a
receipt or a bank statement may be damaged or protected by a password. The
report stays as it is, to be corrected and saved again.

Saving does not discard the draft: the Claimant may change the report and
save it again. The draft goes when the Claimant starts a new report.
