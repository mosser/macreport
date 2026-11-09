# Prepare an Expense Report

What the Claimant does, step by step, and what the system checks at each
step. The terms are those of `domain-model.md`.

## Opening the system

The system is one HTML file the Claimant opens in their browser, from their
computer. When the browser kept a draft, the system opens on it, at the
Report step; otherwise it opens on an empty report.

When the browser refuses to keep a draft, the system says so on every step:
closing the page will lose the report. Everything else works.

Under every step, the footer names the system and its version, and the
McMaster Centre for Software Certification; gives the name of each document
`config/policy.json` lists, separated by a middle dot, each a link that opens it
in a new tab of the browser; and states: *Everything you enter and add stays in this
browser, on this computer. Nothing is collected, sent or shared.*

**New report** is offered on every step. It asks for confirmation, in a
dialog over the step as every confirmation is, then
discards the draft, its expenses and its documents, and opens the Report step
on a report holding only the name of claimant, position and email, and the
supervisor or the host with their email, kept as the new draft. When the browser does not delete the draft, the report
stays as it is and the system says so, so that the Claimant can try again.

## The steps

The steps follow one another; Back returns to the previous one, and the
stepper lets the Claimant go back to any step already reached. Every change is
kept in the draft as soon as it is made, incomplete as it may be: a required
field left empty, an expense whose receipt is still to come. A required
field is marked with an asterisk (*) next to its name; what it needs besides
being filled in is shown next to it. A value typed that does not follow its
field's rule is shown with that rule, and kept once it does. A date is typed
in its parts, moving on from one to the next by itself, with no key to press
between them.

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
| Supervisor, supervisor's email | Asked of a Student or a Postdoctoral fellow, and then required: the supervisor's name, and an email address. |
| Host, host's email | Asked of a Visitor, and then required: the host's name, and an email address. |
| Purpose | Required. |
| Business travel | Ticked for a report whose purpose took the claimant away. Unticked, the report has no dates. |
| First day | Asked of a business travel, and then required: a calendar date. |
| Last day | Asked of a business travel, and then required: a calendar date, not before the first day. Its picker offers no date before the first day. Left empty, it takes the day after the first day once the Claimant leaves First day; it may be changed, to the first day for a travel of one day. |
| Location(s) | Asked of a business travel, and then required: where it took the claimant, as free text. |
| Account name | Required, free text. |
| Account code | Optional, free text. Written after the account's name, in parentheses. |

Choosing another position takes the supervisor or the host out of the
report; unticking business travel takes the dates, the locations, the per
diems and the travel justifications out. Changing the dates takes out the per
diems of the days no longer between them. Continue is offered once every required field is valid.

### 2. Expenses

The expenses, under the heading *Itemized expenses* once there is one, sorted
by date, then in the order they were added. Each shows
its date, on one line, its description, its foreign amount, its claimed amount, its
receipt or *Missing receipt*, its bank statement or *Paid in cash*, and, in red, what it still lacks: a required field, or a
document whose name a document before it already has. A document's name opens the
document in a new tab of the browser. Each has **Change**, a pen, and
**Remove**, a trash can. **Add an expense** stands above them; next to it,
**Add from a preset**, when an expense preset is offered to the report, then, for a
business travel whose dates are valid, **Manage per diems**.
When a meal is claimed, the per diems stand under the expenses, under the
heading *Per diems*: each of those days, by its day of the week in full, on a
line of its own, and its date, in a column as wide as the dates of the expenses,
as on the cover of the report document: its meals claimed, domestic then international, then its
meals not claimed and their reasons, without their amounts.

**Add an expense** adds an empty expense to the report and opens its fields;
**Change** opens the fields of an expense, filled in. Every change is kept as
it is typed, as on any step. While they are open, Continue is not offered:
**Done** closes them and shows the expenses. Leaving the step closes them
too. **Discard** closes them and undoes every change made since they
opened: an expense just added leaves the report, an expense changed is as it
was, its documents and their names included; nothing else of the report
changes, a file added meanwhile on another step included. A value typed that breaks its
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
| Bank statement | One, unless the expense was paid in cash. |

A receipt or a bank statement is added from the expense, dropped on the zone
of its kind or chosen from the computer, or chosen among the receipts or bank
statements already in the report. The same document may be chosen by
several expenses. The trash can next to it takes it out of this expense
only.

A Receipt that holds no document also offers **Missing receipt**, and a Bank
statement that holds none **Paid in cash**. Neither is offered while a file is
being added.

**Paid in cash** takes the place of the field and of its name: *Paid in cash*, and
**Take back**, a cross.

**Missing receipt** opens a dialog over the step, under the heading *Missing
receipt*, which states: *McMaster's official Missing Receipt Authorization Form
will be written on your behalf. You will have to sign it in the final PDF.* and, in
bold, *Accounts Payable may not accept it, and may return the report.* **Cancel**, or Escape, leaves the expense as it was. **Done**, offered
once what is required is filled in, closes it: what it holds is kept then, not as
it is typed. *Missing receipt* then takes the place of the field and of its name, with **Change**,
a pen, which opens the dialog filled in, and **Take back**, a cross.

| Field | Rule |
|---|---|
| Reason for missing original receipt | Required. It may run over several lines: its line breaks are kept in the report document. |
| Paid to | Required. |

Then, in a section *Additional information on the claimant*:

| Field | Rule |
|---|---|
| Your job title | Required. *E.g., Associate Prof, Research Engineer, PhD Student.* |
| Phone extension | Optional. |

The dialog of an expense without a missing receipt starts with the job title and the
phone extension of the last expense added that has one, when the report holds one.
Changed there, they change for this expense only.

**Take back** asks for no confirmation: the field holds no document again, its
zone and the documents to choose from are back, and what the dialog held goes.
Discard undoes it, as any change to the expense.

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
| Breakfast, lunch, dinner | Each ticked when claimed, at its rate, as `config/per-diems.json` sets it: in Canadian dollars for a domestic meal, in US dollars for an international one. A per diem starts with no meal claimed. The rates and the amounts are not shown here: the Review step and the report document give them. |
| Reason | Optional, for a meal not claimed of a day with a meal claimed: why it is not, as *provided by the conference*. **Add a reason for not claiming lunch (optional)**, under the meals, opens the field of that meal, *Reason for not claiming lunch (optional)*; a reason given stays shown in it. The trash can next to the field takes the reason out, and Add a reason back. A day without a meal claimed asks for none: the report document leaves it out. Ticking the meal takes its reason out. |

**Add from a preset** opens a dialog over the step, under the heading *Add from a
preset*. A preset for a business travel is offered once the dates of the travel are
valid; a preset for another report, when the report is not a business travel.

| Field | Rule |
|---|---|
| Preset | Required, one of the presets offered, in the order `config/expense-presets.json` gives them. The first starts chosen. Choosing another empties the fields of the one before. |

Then the preset parameters of the preset chosen, by their labels, each required
unless the table of presets says optional:

| Parameter | Rule |
|---|---|
| Text | On one line. |
| Date | A calendar date. |
| Month | Chosen in a list, by its month in full and its year, as *January 2026*: from the month of the date the preset names, as many months as it sets. Not offered until that date is valid. When that date changes, the month chosen stays while the list still holds it, and goes otherwise. |
| Amount | In Canadian dollars, more than zero, at most two decimals. |
| Foreign amount | **Paid in another currency**, ticked or not. When ticked, **Currency**, required, a three-letter ISO 4217 code other than CAD, its name shown under it, and **Foreign amount**, optional, more than zero, at most two decimals. |

Once every required parameter is given and none breaks its rule, the expenses the
preset would add stand under them, in order, each with its date, its description, its foreign amount
and its claimed amount, as far as it has them, and a tick box, ticked. A box
unticked stays so while the parameters change, by its place among the expenses.

**Add 4 expenses**, by the number ticked, or **Add 1 expense**, is offered once one is ticked. It closes
the dialog and adds the expenses ticked, each with what is shown and nothing else:
each then lacks, in red, what any expense lacks, and is changed or removed like any
other. What the report already holds stays as it is, and adding the same preset
again adds its expenses again. Changing the dates of the report later leaves the
dates of those expenses as they are. **Cancel**, or Escape, leaves the report as it
was: what the dialog holds is kept when it is added, not as it is typed.

A preset that repeats adds one expense per month, from the month of its date to the
month chosen, both included. Each falls on the day of the month of that date, or on
the last day of a shorter month: from January 31, February 28, then March 31.
*<month>* is the month in full, in English, and *<year>* the year.

| Preset | Offered to | Preset parameters | Expenses |
|---|---|---|---|
| Monthly subscription | Another report | Title (text); First expense (date); End month (month, from First expense, 36 months); Monthly amount (CAD) (amount, optional); Paid in another currency (foreign amount, optional) | Repeating from First expense to End month: *<title> - <month> <year>*, with the amount and the foreign amount given. |
| Travel to conference (Air) | A business travel | None | On the first day: *Transport: home to airport*, *Transport: airport to hotel*. Without a date: *Hotel*. On the last day: *Transport: hotel to airport*, *Transport: airport to home*. |

Continue is offered once there is at least one expense or a meal claimed,
and every expense follows the rules above.

### 3. Additional documents

The travel justifications of a business travel, then the additional
documents, each with its name and its file name. The
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
- a PDF that needs a password to open.

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

A PDF that opens without a password, though one restricts printing or copying it, is
unlocked and added. Under its field, for as long as the step shows it, the step says so:
*<file name> was protected by a password, and has been unlocked: the report document
holds it without that protection.*

What is said of a file refused stands under its field, until a file is given to that
field again or the step is left. A file still being read when another is given, or when
the step is left, is said of once it is read, there or on coming back: a file refused
never goes unsaid.

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

With a finding, the step shows its findings, as errors, and nothing else. Without
one, it shows the report as it will be written: the cover, with the table of the
expenses, under the heading *Itemized expenses*, each on two lines as in the report document, its documents by their
names, *Missing receipt* and *Paid in cash* standing where a document would, or *No expense entered* in grey; the per diems of a business travel, under their own
heading, one row per day with a meal claimed, or *No per diem entered* in
grey, with its numbers on
the cover, its date, domestic, international or both, each meal claimed with
its rate in its currency or not claimed with its reason, and the day's
total, one amount per currency; then the total of the report, as on the
cover of the report document; then each section with its documents, their labels and their names, every table
of documents spaced alike. A document's name opens the document in a new
tab of the browser, from the file the Claimant added, or from its reduced file
once reduced. A missing receipt authorization has no file to open: its section shows its
label, who was paid, under the heading *Payee*, and its expense, without a link. The Entered boxes and the Policy section are the report document's alone.

The sizes stand at the top of the step: the size of the report
document, or *Working out the sizes…* until the sizes are known, Save the report
staying offered meanwhile; then each document heavy or reduced, by its label and
its name, with its size. Nothing is reduced unless the Claimant asks. A heavy
document that reducing makes at least 10 %
smaller also offers **Reduce**, an icon and its size once reduced, as *545 KB*,
named *Reduce to 545 KB*. Once reduced, even when no longer heavy, it shows a link
to the file added and one to its reduced file, each opening in a new tab of the
browser, so that the Claimant can compare them, a photo showing upright in both,
as *Original 9.4 MB → Reduced 545 KB*, and offers **Restore**, which brings back the file added. **Reduce all**, an icon and its name, reduces every
document on offer, when there is more than one.

| Finding | Wording |
|---|---|
| A required field of the Report step is missing or invalid | The field, and what it needs. |
| No expense, and no meal claimed | No expense or per diem is claimed. |
| An expense breaks a rule of the Expenses step | The expense, by its date and description, and the rule. |
| A business travel has no travel justification | At least one travel justification is required. |
| A document has the name of a document before it | The document, by its file name, and its name. |
| A text holds a character the report document cannot write | The field, the expense or the per diem when it is one, and each character with its code, as *日 (U+65E5)*. For a name: the document, by its kind and file name. It holds no step: it is found here. |

**Save the report** is offered when there is no finding. It writes the report
document (`report-document.md`) and hands it to the browser to be saved as
`expense-report-<date>-<claimant>.pdf`: the date is the first day of a
business travel, or the date of the earliest expense of another report; the
name of the claimant in lower case, without accents, words joined by
hyphens. The browser does not tell the system whether it wrote the file or
the Claimant cancelled, so the step says the report document was handed to
the browser, with its file name, and keeps Save the report on offer to hand
it over again. It also says that the bank statements, when there are
some, are to be redacted in the report document before it is submitted; that
each missing receipt authorization, when there is one, is to be signed, once
those bank statements are redacted; and that the draft, bank statements included, stays in this browser until New
report. What it says holds for the report
as saved: once the report changes, it is no longer said.

When the report document cannot be written, the step says so, and that a
receipt or a bank statement may be damaged or need a password to open. The
report stays as it is, to be corrected and saved again.

Saving does not discard the draft: the Claimant may change the report and
save it again. The draft goes when the Claimant starts a new report.
