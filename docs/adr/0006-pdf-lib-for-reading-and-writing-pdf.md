# ADR 0006: `@cantoo/pdf-lib` reads the documents and writes the report document

- **Status:** Accepted
- **Date:** 2026-11-09
- **Deciders:** Sébastien Mosser

## Context

The system reads the PDF documents the Claimant adds (is it a PDF, how many
pages, is it protected) and writes the report document: generated pages
(cover, section pages, missing receipt authorizations), every page of every
PDF document copied, less what no reader shows (ADR 0011), images placed on pages of their own, a stamp
on every page, and links from labels and expense numbers to the pages they
name (`docs/specs/report-document.md`). All of it runs in the
browser, from one file, with no network (ADR 0001): the library and its fonts
are inlined into the page and cannot load a worker or a font from elsewhere.

The text written comes from the Claimant: names of attendees, merchants and
places, in any language written in the Latin alphabet and sometimes in Greek
or Cyrillic. The fourteen standard PDF fonts need no embedding but cover the
Windows-1252 character set only, which lacks letters such as ł, ř, ş or ő.

Options considered for the library:

- **pdfmake.** Declarative layout of new documents, but cannot copy the pages
  of an existing PDF, which is the core of the report document.
- **jsPDF.** Draws new documents; cannot copy existing pages either.
- **pdf.js.** Mozilla's reader: renders pages, does not write PDF. Turning
  every page into an image would lose the text of receipts and statements and
  multiply the size of the report document.
- **pdf-lib.** Creates and modifies PDFs: copies pages between documents,
  draws text, lines and rectangles, embeds JPEG and PNG images and TrueType
  fonts, reads page sizes and rotations. MIT, no dependency on the DOM, runs in
  Node. Its last release dates from 2021.
- **`@cantoo/pdf-lib`.** A fork of pdf-lib with the same API, maintained and
  released through 2026, MIT.

Options considered for the font engine, which pdf-lib needs to embed a font:

- **`@pdf-lib/fontkit`**, pdf-lib's own, last released in 2021. The fork
  takes it for the newer engine and calls its subsetter the newer way, which
  fails: with it, a font can only be embedded whole.
- **`@cantoo/fontkit`**, the fork's companion, based on fontkit 2, MIT, and
  the engine the fork recommends.

Options considered for the fonts:

- **The standard Helvetica.** Nothing to embed; refuses common European names.
- **An embedded font** covering the Latin, Greek and Cyrillic alphabets. A few
  hundred kilobytes more in the single file; the report document carries only
  the glyphs it uses.
- **An embedded font with Chinese and Japanese as well.** Several megabytes in
  the single file, for text McSCert's administration rarely receives.

## Decision

- **`@cantoo/pdf-lib`**, exact-pinned, is the only PDF library, with
  **`@cantoo/fontkit`**, exact-pinned, to embed fonts. Both are used in
  `src/io/` only: `src/domain/` and `src/ui/` never import them.
- **Reading** a PDF document, always through `src/io/load-pdf.ts`, opens it with
  the empty password and counts its pages. A PDF that opens without a password is
  read, though a password restricts printing or copying it, as with many bank
  statements: a Claimant cannot be asked to unlock their own statement, and must be
  able to redact the report document. The step says that it was unlocked, since the
  report document no longer holds that restriction. A PDF that needs a password to open is
  refused when added, with its reason
  (`docs/specs/prepare-an-expense-report.md`): the system asks for no password.
- **Reading** an image checks its format from its first bytes (JPEG or PNG),
  whatever its file name says, that the library can embed it, and that a JPEG holds
  its image to its end, its scan started and its end after that. A JPEG is not
  decoded when added: a file cut short is found, damage within its scan is not.
- **Writing** the report document is one function of `src/io/` that takes the
  report's layout from the domain (ADR 0007) and returns the bytes of the PDF.
  It draws, copies, paginates, stamps and links; it never orders, numbers,
  labels or totals, and what every link goes to comes from the layout. Text
  wraps, never clipped, and a generated part longer than a page continues on
  the next (ADR 0007: pagination is the writer's).
- **Fonts.** Noto Sans Regular and Bold (SIL Open Font License 1.1), cut down
  to the Latin, Greek and Cyrillic alphabets and common punctuation, are kept
  in `src/assets/fonts/` with their licence and a note of how they were cut
  down, and inlined by the build. The report document embeds the subset of
  the glyphs it uses. Whether a text can be written is decided against the
  same font, so the domain's finding and the writer cannot disagree: the
  domain, which imports no PDF library, holds the characters of the font in
  `src/domain/writable-characters.ts`, and a test under `src/io/` compares them
  with both fonts.
- **Stamping a copied page** first wraps its own content in a saved graphics
  state, so that the stamp is drawn in the page's coordinates whatever the
  content left behind, and places the stamp and its links according to the
  page's crop box and rotation.

## Consequences

**Positive**

- One library covers reading, copying, drawing, images and fonts; nothing else
  is needed to write the report document.
- The text of receipts and statements stays text in the report document.
- Names in European languages, Greek and Cyrillic are written as typed.
- The report document is written and read back in Node tests (ADR 0004).

**Negative / accepted trade-offs**

- The library and the two fonts are the largest part of the single file.
- A PDF that needs a password to open is refused: the Claimant unlocks it first.
- The report document does not keep the restrictions of a PDF that opens without
  a password.
- Chinese, Japanese and emoji cannot be written; they are findings (ADR 0010).
- The fork is maintained by a company, not by pdf-lib's author; moving back to
  pdf-lib or to another fork is a dependency change confined to `src/io/`.

## Compliance

A change is compliant with this ADR when:

- `@cantoo/pdf-lib` and `@cantoo/fontkit` are the only PDF libraries in
  `package.json`, exact-pinned;
- only files under `src/io/` import them;
- the report document writer takes its order, labels, numbers, totals and
  link targets from the domain and computes none of them;
- the only fonts embedded in the report document are those of
  `src/assets/fonts/`, subset, and that folder holds their licence.
