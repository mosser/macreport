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

**New report** is offered on every step. It asks for confirmation, then
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
**Purpose** (purpose, business travel, and its first and last day) and
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
| Account | Required, free text. |

Choosing another position takes the supervisor or the host out of the
report; unticking business travel takes the dates and the travel
justifications out. Continue is offered once every required field is valid.

### 2. Expenses

The expenses, sorted by date, then in the order they were added. Each shows
its date, its description, its foreign amount, its claimed amount, its
receipts or that its receipt is missing, and its bank statements or that it
was paid in cash. The Claimant adds, changes and removes expenses.

| Field | Rule |
|---|---|
| Date | Required, a calendar date. It may fall outside the dates of the report. |
| Description | Required. For a meal not only for the Claimant, it lists the attendees and their affiliations. |
| Claimed amount | Required, in Canadian dollars, more than zero, at most two decimals. |
| Paid in another currency | Optional. When set: the amount, more than zero, at most two decimals, and its currency, a three-letter ISO 4217 code other than CAD. |
| Receipts | At least one, unless the receipt is missing. |
| I don't have the receipt | When ticked: the expense has no receipt, and two more fields are required: **Paid to**, who was paid, and **Reason**, why the receipt is missing. |
| Paid in cash | When ticked: the expense has no bank statement. |
| Bank statements | At least one, unless the expense was paid in cash. |

Receipts and bank statements are added from the expense, dropped on the zone
of their kind or chosen from the computer, or chosen among the receipts and
bank statements already in the report. The same document may be chosen by
several expenses. Removing an expense, or a document from an
expense, takes out of the report any receipt or bank statement no expense
refers to any more.

Continue is offered once there is at least one expense and every expense
follows the rules above.

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
document of that same kind, the document already there is chosen. Otherwise,
already a document of another kind or added again as a travel justification
or an additional document, it is refused, naming the document it already is,
by its kind and its name: a document has one kind. Adding several files at
once handles each on its own.

### Naming a document

A document added takes its file name, without its extension (`.pdf`,
`.jpeg`, `.png`), as its name. Next to it, its **Name** is a field the
Claimant may change at any time, on the step it was added from: an invoice,
a statement or a programme named as the Claimant calls it. A name left empty
is the file name without its extension again. The name is what the Review
step and the report document call the document.

No two documents of the report have the same name, whatever its case. A
document added whose name another document already has is named after it,
followed by (2), (3) and so on. A name typed that a document before it, in
the order of the steps, already has is shown with its rule, *Not the name of
another document.*, and Continue is not offered.

### 4. Review

The report as it will be written: the cover, with the table of the expenses
and its total, then each section with its documents, their labels, their
names and their pages. Then the findings, if any.

| Finding | Wording |
|---|---|
| A required field of the Report step is missing or invalid | The field, and what it needs. |
| No expense | No expense is claimed. |
| An expense breaks a rule of the Expenses step | The expense, by its date and description, and the rule. |
| A business travel has no travel justification | At least one travel justification is required. |
| A document has the name of a document before it | The document, by its file name, and its name. |
| A text holds a character the report document cannot write | The field, the expense when it is one, and the character. For a name: the document, by its kind and file name. |

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
