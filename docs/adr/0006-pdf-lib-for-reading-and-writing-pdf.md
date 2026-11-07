# ADR 0006: `@cantoo/pdf-lib` reads the documents and writes the report document

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

The system reads the PDF documents the Claimant adds (is it a PDF, how many
pages, is it protected) and writes the report document: generated pages
(cover, section pages), every page of every PDF document copied as it is,
images placed on pages of their own, and a stamp on every page
(`docs/specs/report-document.md`). All of it runs in the browser, from one
file, with no network (ADR 0001): the library is inlined into the page and
cannot load a worker or a font from elsewhere.

Options considered:

- **pdfmake.** Declarative layout of new documents, but cannot copy the pages
  of an existing PDF, which is the core of the report document.
- **jsPDF.** Draws new documents; cannot copy existing pages either.
- **pdf.js.** Mozilla's reader: renders pages, does not write PDF. Turning
  every page into an image would lose the text of receipts and statements and
  multiply the size of the report document.
- **pdf-lib.** Creates and modifies PDFs: copies pages between documents,
  draws text, lines and rectangles, embeds JPEG and PNG images, uses the
  standard PDF fonts without embedding them, reads page sizes and rotations.
  MIT, no dependency on the DOM, runs in Node. Its last release dates from
  2021.
- **`@cantoo/pdf-lib`.** A fork of pdf-lib with the same API, maintained and
  released through 2026, MIT.

## Decision

- **`@cantoo/pdf-lib`**, exact-pinned, is the only PDF library. It is used in
  `src/io/` only: `src/domain/` and `src/ui/` never import it.
- **Reading** a PDF document checks that it opens, that it is not protected by
  a password, and counts its pages. A protected PDF is refused when added, with
  its reason (`docs/specs/prepare-an-expense-report.md`), since its pages
  cannot be copied faithfully.
- **Reading** an image checks its format from its first bytes (JPEG or PNG),
  whatever its file name says, and that the library can embed it.
- **Writing** the report document is one function of `src/io/` that takes the
  report's layout from the domain (ADR 0007) and returns the bytes of the PDF.
  It draws, copies and stamps; it never orders, numbers, labels or totals.
- **Fonts** are the standard Helvetica and Helvetica Bold, which need no
  embedded file; their character set is the limit of what the report document
  can write (ADR 0010).
- **Stamping a copied page** first wraps its own content in a saved graphics
  state, so that the stamp is drawn in the page's coordinates whatever the
  content left behind, and places the stamp according to the page's crop box
  and rotation.

## Consequences

**Positive**

- One library covers reading, copying, drawing and images; nothing else is
  needed to write the report document.
- The text of receipts and statements stays text in the report document.
- The report document is written and read back in Node tests (ADR 0004).

**Negative / accepted trade-offs**

- The library is the largest part of the single file.
- A PDF protected by a password is refused: the Claimant prints it to a new PDF
  first.
- The standard fonts cover the Windows-1252 character set only.
- The fork is maintained by a company, not by pdf-lib's author; moving back to
  pdf-lib or to another fork is a dependency change confined to `src/io/`.

## Compliance

A change is compliant with this ADR when:

- `@cantoo/pdf-lib` is the only PDF library in `package.json`, exact-pinned;
- only files under `src/io/` import it;
- the report document writer takes its order, labels, numbers and totals from
  the domain and computes none of them;
- the report document embeds no font file.
