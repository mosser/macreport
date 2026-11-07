# ADR 0009: Files are added and saved, never uploaded or downloaded

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

The system runs in the Claimant's browser, from a file on their computer
(ADR 0001). Receipts and bank statements are read where they are, and the
report document is written on the same computer. Nothing crosses a network.

Web applications say "upload" for handing them a file and "download" for
getting one back. Both words mean a transfer over a network. Used here they say
the opposite of what happens: a Claimant who reads "Upload your bank
statement" is entitled to ask where it was sent.

Options considered:

- **The words of the web.** Familiar, and wrong for this system.
- **The words of the web, explained** in a notice. A notice that corrects the
  wording of its own screen is weaker than one that agrees with it.
- **The words of a desktop application**, which this is in every respect but
  its packaging.

## Decision

| Word | Meaning |
|---|---|
| **Add** | The Claimant hands a file to the system, which reads it in the browser, on their computer. |
| **Remove** | The Claimant takes a document or an expense out of the report. |
| **Save** | The system hands the report document to the browser, which writes it on the Claimant's computer. |

- "Upload" and "download" are used for nothing the system does, in the
  interface, the report document, the specification, the code and its tests.
- They stay where they are true: a release is downloaded from GitHub
  (ADR 0003).
- One technical exception: `download` is the HTML attribute that makes a link
  save its target under a name. `src/io/save.ts` sets it, with a comment
  saying so; it is the only occurrence under `src/`.
- `add`, `remove` and `save` are glossary terms (`docs/specs/domain-model.md`).

## Consequences

**Positive**

- The interface says what the system does, and agrees with ADR 0001.
- The rule is mechanical: `npm run check` fails on either word.

**Negative / accepted trade-offs**

- The browser's own interface still says "download" for a saved file, and puts
  it in the Downloads folder by default; the system cannot change that.

## Compliance

A change is compliant with this ADR when:

- "upload" and "download", in any case, appear nowhere under `src/` except the
  `download` attribute in `src/io/save.ts`, and nowhere in `docs/specs/` except
  about obtaining a release;
- `scripts/check-adr.sh` checks it.
