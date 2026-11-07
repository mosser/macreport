# ADR 0008: The draft is kept in the browser's IndexedDB, best effort

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

Preparing a report takes more than one sitting: receipts arrive after the
trip, a bank statement at the end of the month. Closing the page must not lose
the work. Once the report document is saved, though, it is the only thing that
counts: the draft has no value after that.

The system is one file opened from disk with no server (ADR 0001), so whatever
keeps the draft is in the browser. A draft holds documents, PDFs and images
of a few megabytes each, and bank statements among them.

Under `file://`, browsers differ: the storage origin of a local file is
browser-specific, and storage may be refused or cleared.

Options considered:

- **`localStorage`.** Strings only, about five megabytes per origin: too small
  for documents.
- **A working file** the Claimant saves and adds back to resume. Survives a
  change of browser or version, but asks the Claimant to keep a second file
  next to the report document, which is the only one that counts.
- **No storage.** Simplest; an accidental close loses everything.
- **IndexedDB.** Keeps structured data and binary content, with a quota in the
  hundreds of megabytes or more.

## Decision

- **The draft is kept in IndexedDB**, in a database named `macreport`. There is
  one draft. Each document's content is kept as its bytes, apart from the
  report's fields and expenses, which refer to documents by an identifier
  given when the document is added.
- **Every change is written at once.** There is no "save draft" action.
- **At opening**, the system restores the draft when there is one.
- **Best effort.** Every access is guarded: when IndexedDB is unavailable,
  refused or fails, the system works without it and the wizard shows a notice
  on every step that closing the page will lose the report. The system asks
  the browser for persistent storage, and goes on whatever the answer.
- **New report** deletes the draft and its documents.
- `src/io/draft-store.ts` is the only module that touches IndexedDB; it maps
  the domain model to what IndexedDB keeps and back (ADR 0007). Nothing else
  is stored in the browser, and nothing in `localStorage`.

## Consequences

**Positive**

- Closing the page, or the browser, loses nothing in the usual case.
- Bank statements stay on the Claimant's computer.

**Negative / accepted trade-offs**

- The draft belongs to one browser on one computer, and, under `file://`, to
  the browser's notion of the file's origin. A browser that gives each local
  file its own origin does not show the draft of `macreport-v1.0.0.html` to
  `macreport-v1.1.0.html`, or to the same file once moved. A report is finished
  with the file it was started with.
- Which browsers keep a draft under `file://`, and for how long, is checked by
  hand on Chrome, Firefox, Edge and Safari for each release; the result is
  written in the README.
- Bank statements stay in the browser's profile until New report. The Review
  step says so once the report is saved.

## Compliance

A change is compliant with this ADR when:

- only `src/io/draft-store.ts` uses IndexedDB, and no file uses `localStorage`,
  `sessionStorage`, cookies or the Cache API;
- every IndexedDB access is guarded, and the system works when it is missing;
- New report deletes the draft and every document's content.
