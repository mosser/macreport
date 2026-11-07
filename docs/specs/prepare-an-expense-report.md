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
kept in the draft as soon as it is made.

### 1. Report

| Field | Rule |
|---|---|
| Name of claimant | Required. |
| Position or title | Required. |
| Email | Optional. Written on missing receipt authorizations. |
| Extension | Optional. Written on missing receipt authorizations. |
| Event | Required. |
| First day of the event | Required, a calendar date. |
| Last day of the event | Required, a calendar date, not before the first day. |
| Account | Required, free text. |

Continue is offered once every required field is valid.

### 2. Expenses

The expenses, sorted by date, then in the order they were added. Each shows
its date, its description, its foreign amount, its claimed amount, its
receipts or that its receipt is missing, and its bank statements or that it
was paid in cash. The Claimant adds, changes and removes expenses.

| Field | Rule |
|---|---|
| Date | Required, a calendar date. It may fall outside the dates of the event. |
| Description | Required. For a meal not only for the Claimant, it lists the attendees and their affiliations. |
| Claimed amount | Required, in Canadian dollars, more than zero, at most two decimals. |
| Paid in another currency | Optional. When set: the amount, more than zero, at most two decimals, and its currency, a three-letter ISO 4217 code other than CAD. |
| Receipts | At least one, unless the receipt is missing. |
| I don't have the receipt | When ticked: the expense has no receipt, and two more fields are required: **Paid to**, who was paid, and **Reason**, why the receipt is missing. |
| Paid in cash | When ticked: the expense has no bank statement. |
| Bank statements | At least one, unless the expense was paid in cash. |

Receipts and bank statements are added from the expense, or chosen among the
receipts and bank statements already in the report. The same document may be
chosen by several expenses. Removing an expense, or a document from an
expense, takes out of the report any receipt or bank statement no expense
refers to any more.

The step reminds the Claimant that bank statements are redacted before they
are added: the system does not redact.

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

A file already in the report, with the same content, is not added twice:
added from an expense as a receipt or a bank statement, the document already
there is chosen; added as an additional document, it is refused, naming the
document it already is. Adding several files at once handles each on its own.

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
`expense-report-<first day of the event>-<claimant>.pdf`, the name of the
claimant in lower case, without accents, words joined by hyphens. The step
then says it is saved, with the file name; that each missing receipt
authorization, when there is one, is to be signed; and that the draft, bank
statements included, stays in this browser until New report.

Saving does not discard the draft: the Claimant may change the report and
save it again. The draft goes when the Claimant starts a new report.
