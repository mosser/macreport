# ADR 0012: The policy is linked, from a configured address

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Sébastien Mosser

## Context

McMaster's policy AP-01, *Reimbursements to Individuals for University Business*,
and its guidelines set the rules a report answers to. A Claimant preparing a
report needs them at hand, and so does the administration reading it. Both are
PDFs on McMaster's websites, whose addresses change as the policy is revised.

The system runs from one file, and the page fetches nothing and sends nothing
(ADR 0001). The footer states: *Nothing is collected, sent or shared.*

Options considered for reaching the documents:

- **Embed them in the single file.** They work offline, but the system then
  distributes a copy that goes out of date, for about 500 KB.
- **Link to them.** The reader always gets McMaster's own current document, and
  the page itself fetches nothing. The link needs a network when followed, and
  breaks when the address changes.

Options considered for where the addresses live:

- **In the code.** A new address is a code change, in as many places as it is used.
- **In a configuration file read at build time**, as the per diem rates and the
  document sizes are. A new address is one line, and a new release.

Options considered for where the interface offers them:

- **A question mark in the header, opening a dialog.** Visible on every step without
  scrolling, but an icon that says little, and a click more before the document.
- **Links in the footer.** Named for what they open, one click from the document, and
  under every step, at the cost of scrolling down a long step.

## Decision

- **The documents of the policy are links, never copies.** A link opens in a new
  tab of the browser or in the PDF reader's own way, only when the reader follows
  it.
- **`config/policy.json` holds them**, each a name and an https address, and is the
  only place an address appears. The system reads it when it is built, and refuses
  to build unless it holds at least one document, each with a name the report
  document can write.
- **The report document has a Policy section** after the expenses, on the cover: the
  name of each document, a link marked with an arrow (`report-document.md`).
- **The footer of the interface links to them**, under every step, each by its name
  and in a new tab.

## Consequences

**Positive**

- A new address, or a revised policy, is one line in one file.
- The reader follows McMaster's current document, not a copy.
- The page still fetches and sends nothing: the footer's statement holds, a link
  followed being the reader's own choice, in a tab of its own, without a referrer.

**Negative / accepted trade-offs**

- A report document already saved keeps the addresses of the version that wrote it:
  when McMaster moves a document, its link in an older report breaks.
- When an address changes, a new version is released.
- A link needs a network when followed, and does nothing on a printed copy.

## Compliance

A change is compliant with this ADR when:

- no business code under `src/` holds an http or https address;
- `config/policy.json` is the only source of the documents, read through
  `src/domain/policy.ts`, which the build refuses unless it holds valid ones;
- tests read the links back from a written report document, and from the footer.
