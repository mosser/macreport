# ADR 0006: `@cantoo/pdf-lib` reads the documents and writes the report document

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

The system reads the PDF documents the Claimant adds (is it a PDF, how many
pages, is it protected) and writes the report document: generated pages
(cover, section pages, missing receipt authorizations), every page of every
PDF document copied as it is, images placed on pages of their own, and a stamp
on every page (`docs/specs/report-document.md`). All of it runs in the
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

Options considered for the fonts:

- **The standard Helvetica.** Nothing to embed; refuses common European names.
- **An embedded font** covering the Latin, Greek and Cyrillic alphabets. A few
  hundred kilobytes more in the single file; the report document carries only
  the glyphs it uses.
- **An embedded font with Chinese and Japanese as well.** Several megabytes in
  the single file, for text McSCert's administration rarely receives.

## Decision

- **`@cantoo/pdf-lib`**, exact-pinned, is the only PDF library, with
  **`@pdf-lib/fontkit`**, exact-pinned, to embed fonts. Both are used in
  `src/io/` only: `src/domain/` and `src/ui/` never import them.
- **Reading** a PDF document checks that it opens, that it is not protected by
  a password, and counts its pages. A protected PDF is refused when added, with
  its reason (`docs/specs/prepare-an-expense-report.md`), since its pages
  cannot be copied faithfully.
- **Reading** an image checks its format from its first bytes (JPEG or PNG),
  whatever its file name says, and that the library can embed it.
- **Writing** the report document is one function of `src/io/` that takes the
  report's layout from the domain (ADR 0007) and returns the bytes of the PDF.
  It draws, copies and stamps; it never orders, numbers, labels or totals.
- **Fonts.** Noto Sans Regular and Bold (SIL Open Font License 1.1), cut down
  to the Latin, Greek and Cyrillic alphabets and common punctuation, are kept
  in `src/assets/fonts/` with their licence and a note of how they were cut
  down, and inlined by the build. The report document embeds the subset of
  the glyphs it uses. Whether a text can be written is decided against the
  same font, so the domain's finding and the writer cannot disagree.
- **Stamping a copied page** first wraps its own content in a saved graphics
  state, so that the stamp is drawn in the page's coordinates whatever the
  content left behind, and places the stamp according to the page's crop box
  and rotation.

## Consequences

**Positive**

- One library covers reading, copying, drawing, images and fonts; nothing else
  is needed to write the report document.
- The text of receipts and statements stays text in the report document.
- Names in European languages, Greek and Cyrillic are written as typed.
- The report document is written and read back in Node tests (ADR 0004).

**Negative / accepted trade-offs**

- The library and the two fonts are the largest part of the single file.
- A PDF protected by a password is refused: the Claimant prints it to a new PDF
  first.
- Chinese, Japanese and emoji cannot be written; they are findings (ADR 0010).
- The fork is maintained by a company, not by pdf-lib's author; moving back to
  pdf-lib or to another fork is a dependency change confined to `src/io/`.

## Compliance

A change is compliant with this ADR when:

- `@cantoo/pdf-lib` and `@pdf-lib/fontkit` are the only PDF libraries in
  `package.json`, exact-pinned;
- only files under `src/io/` import them;
- the report document writer takes its order, labels, numbers and totals from
  the domain and computes none of them;
- the only fonts embedded in the report document are those of
  `src/assets/fonts/`, subset, and that folder holds their licence.
