# Prepare an Expense Report

What the Claimant does, step by step, and what the system checks at each
step. The terms are those of `domain-model.md`.

## Opening the system

The system is one HTML file the Claimant opens in their browser, from their
computer. When the browser kept a draft, the system opens on it, at the
Report step; otherwise it opens on an empty report.

When the browser refuses to keep a draft, the system says so on every step:
closing the page will lose the report. Everything else works.

**New report** is offered on every step. It asks for confirmation, then
discards the draft, its expenses and its documents, and opens the Report step
on an empty report.

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
**Purpose** (purpose, first day, last day) and **Account**.

| Field | Rule |
|---|---|
| Name of claimant | Required. |
| Position | Required, one of Faculty, Postdoctoral fellow, Student, Staff, Visitor. |
| Email | Required, an email address. |
| Extension | Optional. Written on missing receipt authorizations. |
| Supervisor, supervisor's email | Asked of a Student or a Postdoctoral fellow, and then required: the supervisor's name, and an email address. |
| Host, host's email | Asked of a Visitor, and then required: the host's name, and an email address. |
| Purpose | Required. |
| First day | Optional, a calendar date. |
| Last day | Optional, a calendar date, not before the first day when both are given. |
| Account | Required, free text. |

Choosing another position takes the supervisor or the host out of the
report. Continue is offered once every required field is valid.

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

The additional documents, each with its file name and number of pages: an
invitation letter, a conference confirmation, an itinerary, a poster,
boarding passes, notes. The Claimant adds and removes them. Continue is always
offered.

### Adding a file

On either step, a file is added when it is a PDF, a JPEG image or a PNG image,
whatever its name says. It is refused, with the reason, when it is:

- of another format;
- damaged, or a PDF without pages;
- a PDF protected by a password.

A file already in the report, with the same content, is not added twice. Added
from an expense as a receipt or a bank statement when it is already a
document of that same kind, the document already there is chosen. Otherwise,
already a document of another kind or added again as an additional document,
it is refused, naming the document it already is, by its kind and its file
name: a document has one kind. Adding several files at once handles each on
its own.

### 4. Review

The report as it will be written: the cover, with the table of the expenses
and its total, then each section with its documents, their labels and their
pages. Then the findings, if any.

| Finding | Wording |
|---|---|
| A required field of the Report step is missing or invalid | The field, and what it needs. |
| No expense | No expense is claimed. |
| An expense breaks a rule of the Expenses step | The expense, by its date and description, and the rule. |
| A text holds a character the report document cannot write | The field, the expense when it is one, and the character. For a file name: the document, and that it is renamed and added again. |

**Save the report** is offered when there is no finding. It writes the report
document (`report-document.md`) and hands it to the browser to be saved as
`expense-report-<date>-<claimant>.pdf`: the date is the first day of the
report, or the date of its earliest expense when it has no first day; the
name of the claimant in lower case, without accents, words joined by
hyphens. The browser
does not tell the system whether it wrote the file or the Claimant cancelled,
so the step says the report document was handed to the browser, with its file
name, and keeps Save the report on offer to hand it over again. It also says
that each missing receipt authorization, when there is one, is to be signed,
and that the draft, bank statements included, stays in this browser until
New report.

Saving does not discard the draft: the Claimant may change the report and
save it again. The draft goes when the Claimant starts a new report.
