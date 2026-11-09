# ADR 0013: Expense presets are configured, and add ordinary expenses

- **Status:** Proposed
- **Date:** 2026-11-08
- **Deciders:** Sébastien Mosser

## Context

Some expenses come in sets the Claimant types again each time: a subscription, one
expense per month with the same words; a conference reached by air, the same
transports around the same hotel. Everything but the documents, and sometimes the
amounts, is known before the first field is filled in. More such sets will come,
and each is a matter of words and dates rather than of behaviour.

An expense follows one set of rules, and what it lacks is shown in red until it
follows them. The draft, the Review step and the report document all work from
expenses. Configuration is read at build time (ADR 0012).

Options considered for where presets live:

- **In the code.** Each new preset is a code change, and its words sit among the rules.
- **In a configuration file read at build time**, as the rates, the document sizes and
  the policy are. A new preset is one entry and a new release.
- **Defined by the Claimant in the interface.** Each Claimant has their own, at the cost
  of an editor for presets, and of a store that outlives New report (ADR 0008).

Options considered for how the file says what a preset adds:

- **A generator named in the file**, such as `"kind": "monthly"`, written in code. The
  file stays small, but a new shape of preset is a code change.
- **Expressions evaluated in the file.** Any preset can be said, at the cost of a language
  to specify, test and keep safe in a page that evaluates nothing else.
- **A closed vocabulary**: named parameters, named dates, a repetition and placeholders.
  Each word has one rule and one test, the build can check a file completely, and a
  preset the vocabulary cannot say adds a word.

Options considered for what a preset leaves in the report:

- **Expenses tied to their preset**, worked out again when a parameter or the dates of
  the report change. They follow those changes, at the cost of a second kind of expense
  in the object model, the draft and every step, and of deciding what happens to an
  expense the Claimant has changed.
- **Ordinary expenses.** Nothing else in the system changes. They do not follow later
  changes to the report.

Options considered for where the interface offers them:

- **One button per preset.** One click less, and a row of buttons growing with the file.
- **One button, then a dialog** in which the preset is chosen, as the missing receipt
  asks what it states. The step stays as it is, however many presets there are.

Options considered for what the Claimant sees before the expenses are added:

- **Nothing.** A mistyped title then lands in every description, with no way of removing
  several expenses at once.
- **The expenses, to read.** The mistake is seen, but an expense not wanted is still added,
  and removed afterwards with a confirmation.
- **The expenses, each with a tick box.** The mistake is seen, and an expense not wanted is
  never added.

Options considered for where a repetition ends:

- **An end date.** Whether the last month is included depends on the days of the two
  dates: January 15 to March 10 stops in February.
- **A month, typed.** The last month is plain, but a year mistyped adds hundreds of
  expenses, needing a limit and a rule worded for it, and browsers differ on a native
  month field.
- **A month, chosen in a list** starting from the first expense's. The last month is
  plain, and neither a month too early nor one too far can be chosen.

## Decision

- **`config/expense-presets.json` holds the presets**, read when the system is built. The
  build refuses a file that breaks a rule below.
- **A preset adds ordinary expenses and keeps no trace of them.** The object model, the
  draft and the report document do not know presets. A preset gives a date, a description,
  an amount and a foreign amount, as far as it has them, and never a document, a missing
  receipt or a payment in cash.
- **The file uses a closed vocabulary**, and nothing in it is evaluated:

  | Word | What it is |
  |---|---|
  | `name` | The name of the preset, not empty, and unique. |
  | `offeredFor` | `businessTravel` or `otherReport`. |
  | `parameters` | Each with an `id`, a `label` and a `type`: `text`, `date`, `month`, `amount` or `foreignAmount`. Only `amount` and `foreignAmount` may have `isOptional`. A `month` names the date it starts from in `startingFrom`, and its list's length in `atMost`. |
  | `expenses` | At least one. Each has a `description`; and may have a `date`, a `claimedAmount` naming an `amount` parameter, and a `foreignAmount` naming a `foreignAmount` parameter. |
  | `date` | A `date` parameter; `firstDay` or `lastDay`, of a preset for a business travel only; or `repetition`, of a repeating expense only. Left out, the expense has no date. |
  | `repeat` | `every`, today only `month`; `from`, a `date` parameter; `until`, a `month` parameter starting from it. |
  | `{…}` in a description | A `text` parameter; or `{month}` and `{year}`, of a repeating expense only. |

  The fixed words of a description are ones the report document can write. A parameter is
  used by an expense, and its `id` is none of the words above.
- **One button, Add from a preset, opens a dialog**, built entirely from the file: the
  preset, its parameters, then the expenses it would add, each with a tick box. Only what
  is ticked is added. The dialog holds what it is given until then, as the missing receipt's
  does.
- **A repetition ends with a month chosen in a list**, of the length the file sets.
- **`src/domain/expense-preset.ts` reads the file and works out the expenses**, with no
  DOM. `src/ui/expense-preset-dialog.ts` asks for the parameters.
- **The table of presets in `prepare-an-expense-report.md` says what the file holds.** A
  change to a preset changes that table in the same commit.

## Consequences

**Positive**

- A new preset is one entry in one file and a row in the specification, as long as the
  vocabulary can say it.
- A mistake in the file stops the build, rather than reaching a Claimant.
- The draft, the Review step, the findings and the report document stay as they are. What
  an expense lacks, or a character the report document cannot write, is found as for any
  other expense.

**Negative / accepted trade-offs**

- A preset the vocabulary cannot say needs a new word, so code and a test.
- Changing the dates of a report does not move expenses already added from a preset.
- Changing or adding a preset needs a release, and a Claimant cannot make their own.
- Expenses added by mistake are removed one by one; the dialog's tick boxes are what
  stands against it.
- Months and years in descriptions are in English, whatever the browser's language.

## Compliance

A change is compliant with this ADR when:

- `config/expense-presets.json` is the only source of the presets, read through
  `src/domain/expense-preset.ts`, which the build refuses unless it holds valid ones;
- no word in the file is evaluated as code;
- `src/domain/report.ts`, `src/domain/expense.ts` and `src/io/draft-store.ts` name no preset;
- every preset in the file is worked out by a test, and every rule of its vocabulary has one.
