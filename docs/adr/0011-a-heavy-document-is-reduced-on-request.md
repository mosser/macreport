# ADR 0011: A heavy document is reduced on request

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Sébastien Mosser

## Context

The report document goes to McSCert's administration as one file. Its generated
pages weigh little: about 50 KB, and about 2 KB more per expense. Its size is
that of its documents, and two kinds of content make them large.

**Images.** A 12-megapixel phone photo is about 5 MB, the same photo as a PNG
about 25 MB, and a scanned PDF holds one such image per page. A phone photo holds
far more pixels than a Letter page shows. Measured on a rendered photo of a
receipt in small print, read at about three times its size on the page:

| Long side | JPEG quality | Size | Reading |
|---|---|---|---|
| 4032 pixels | 92 | 4.9 MB | Sharp |
| 2200 pixels | 85 | 828 KB | Clear |
| 2200 pixels | 75 | 579 KB | Clear |
| 1600 pixels | 75 | 243 KB | Digits soft enough to mistake an 8 |
| 2200 pixels | 0.8, by Chrome's canvas | 251 KB | Clear |

A small image has little to gain and something to lose: a phone screenshot of a
ride receipt, 186 KB and 2400 pixels tall, comes to 134 KB by the same encoding,
with halos around its text.

**Outlines.** A web page printed through the print dialog of macOS can draw its
text as outlines rather than as text: an 8-page conference programme weighs
9.4 MB without a single image, 20,428 shapes drawn in full with four decimals,
604 of them different. Measured on that file:

| What is done | Size |
|---|---|
| As added | 9.4 MB |
| Compressed harder | 7.8 MB |
| Ghostscript | 7.0 MB |
| Coordinates rounded to 0.01 point | 5.6 MB |
| Each different shape kept once, and drawn from there, at 0.01 point | 0.5 MB |

Rendered by Ghostscript and Poppler, every page of that last file differs from
the original by scattered pixels on the edges of glyphs only.

Everything runs in the browser, from one file, with no network (ADR 0001). A
page of a PDF document stays a page, with its text, its links and its form
fields, and a PDF reader's redaction tool works on it (ADR 0010). The PDF library
embeds a JPEG whole, with the Exif data of the photo, a location among it, and
copies from a page everything but its parent: thumbnails, the private data of
the editor that wrote it, its metadata.

Options considered for images:

- **Reduce an image when it is added.** The draft is smaller too, but the
  original is lost, and a poor result cannot be taken back.
- **Reduce every image above a size when the report document is written.** Every
  report is smaller, with nothing to do. But what the administration receives is
  not the file added, nobody is told, nothing shows it on the Review step, and
  nothing takes it back.
- **Reduce a heavy image, when the Claimant asks**, with the browser's canvas. No
  dependency, and the draft keeps the file as it was added. The Claimant looks at
  the result and can take it back, as for a PDF document. A report of twenty
  photos stays at about 100 MB until the Claimant asks, and the canvas does not
  exist in Node.

Options considered for PDF documents:

- **Turn each page into an image** (pdf.js). Loses the text, the links and the
  form fields, and defeats a redaction tool.
- **A PDF engine compiled to WebAssembly** (Ghostscript). Several megabytes in
  the single file, under the AGPL, and it saves a quarter of a file of outlines.
- **Merge identical streams across documents.** Lossless, but saves much only
  when documents embed the same font or logo byte for byte, which PDFs that each
  carry their own subset of a font do not. It finds nothing in a file of outlines.
- **Reduce every PDF document, always.** Every report is smaller, but image
  formats, masks and content streams are many ways of harming a document nobody
  then looks at.
- **Reduce a heavy PDF document, when the Claimant asks.** The Claimant looks at
  the result and can take it back.

Options considered for what makes a document heavy:

- **5 MB.** Rarely flags a document, by which point the report document is
  already hard to send.
- **2 MB.** Flags a phone photo, a multi-page scan, pages of outlines and the
  like, and not a screenshot, whose text an encoding would harm for little gain.

## Decision

- **Nothing is reduced unless the Claimant asks.** A document is written from
  the file added, an image with its pixels as added, a PDF document with the
  content of its pages.
- **A JPEG written holds its image and its colour profile only.** The Exif data
  of a photo, its location among it, is left out, whether it was reduced or not:
  that takes nothing from what the image shows.
- **A page copied from a PDF document leaves out what no reader shows**: its
  thumbnail, the private data of the editor that wrote it, and its metadata. The
  same goes for the images and forms it draws, and a JPEG it draws loses its Exif
  data, whether it is reduced or not.
- **A document is heavy above 2 MB**: by the size it is written at, that of the
  file added, a JPEG without its Exif data, or of its reduced file once reduced.
- **The size is configured.** `config/document-sizes.json` holds the size above
  which a document is heavy, 2 MB, in megabytes and more than zero. The system
  reads it when it is built, and refuses to build otherwise. A claimant cannot
  change it.
- **A heavy image can be reduced, when the Claimant asks**, on the Review step:
  - its long side is at most **2200 pixels**, never enlarged;
  - a JPEG is encoded at **quality 0.8**;
  - a PNG is encoded both as a PNG and as a JPEG, a transparent background
    becoming white in the JPEG, and stays a PNG unless that is more than twice
    the size of the JPEG, so that a screenshot's text stays crisp and a photo
    does not stay at 25 MB.
- **An encoded image is as it was stored**, not turned: the canvas is handed the
  image without its Exif data, and the page turns it as its orientation says, as
  for any image (ADR 0010).
- **A heavy PDF document can be reduced, when the Claimant asks**, on the Review
  step. Reducing leaves its pages, its text, its links and its form fields as
  they are, and does two things:
  - **Its images.** A JPEG in RGB, by a colour profile or not, or in plain grey,
    without a mask or decoding parameters, with a long side above 2200 pixels is
    encoded at the same size and quality, in place. The PDF's colour space says how to
    read the samples, which the canvas keeps: an RGB image keeps that colour space,
    and the canvas is not handed a colour profile the JPEG holds, which would have
    it convert them. A JPEG encoded by the canvas has three components, so a plain
    grey image becomes RGB, and a grey one by a colour profile stays as it is.
  - **Its shapes.** A shape filled, drawn more than once, is kept once and drawn
    from there, its coordinates at 0.01 point. What it cannot rewrite safely it
    leaves as it is: a page holding an inline image, a page with a string running
    from one of its content streams into the next, a page its `UserUnit` enlarges, a shape under a transform that enlarges, a shape filled with a
    pattern, a shape in a path another operator interrupts, a shape in a text
    object.
- **A bank statement's shapes are not shared.** A shape kept apart from its page
  is out of reach of a reader's redaction tool that only rewrites the page, which
  could seem to redact an account number while leaving it in the file. Its images
  are reduced like any other's.
- **Reducing is worked out in advance, and offered with its result.** The Review
  step works it out for each heavy document, and offers it, as *Reduce to
  545 KB*, only when the result is at least 10 % smaller. The Claimant never
  presses a button that does nothing. **Reduce all** does the same for every
  document on offer.
- **Reducing is reversible.** The draft keeps the file added and whether the
  Claimant reduced it, not the reduced file, which is worked out again when
  needed. **Restore** goes back to the file added. A reduced document shows a link
  to the file added and one to its reduced file, so that the Claimant can compare
  them before saving.
- **The Review step shows the size of the report document** once there is no
  finding, from the document actually written, and the size of each heavy
  document, at the top of the step. What is reduced is kept in memory, so that
  saving reuses it.
- **The canvas step is separate from the writer**, in its own file under
  `src/io/`. The writer and the rules around the encoding take an encoder as a
  parameter, so that they run in Node tests.
- **The Claimant sets nothing.** The Claimant is not asked for a quality or a
  size.

## Consequences

**Positive**

- What the administration receives is the file added, unless the Claimant chose
  otherwise and could compare the two.
- A report of twenty phone photos goes from about 100 MB to under 17 MB, on
  request, with the small print of a receipt still readable.
- A programme printed from a web page goes from 9.4 MB to 0.5 MB, on request,
  and looks the same.
- The location a phone stores in a photo does not reach the administration.
- A document that is not reduced keeps every pixel, and every page's content
  byte for byte.
- A heavy document is named on the Review step, so the Claimant knows what to
  act on.

**Negative / accepted trade-offs**

- When the configured sizes change, a new version is released.
- A report of phone photos stays large until the Claimant asks: most of its
  receipts are listed as heavy, which **Reduce all** answers in one click.
- A reduced image holds fewer pixels: for a receipt photographed from far away,
  reading it needs a closer look at the original.
- The Review step works out what reducing gives before it can offer it, which
  takes a while for a report of many photos.
- A heavy PDF document whose size comes from fonts, whose scans are not JPEGs, or
  are in grey by a colour profile, is named but has nothing to offer; the Claimant
  makes it smaller before adding it. So is a heavy bank statement of outlines: the Claimant prints it again with
  the browser's own Save as PDF, which writes real text.
- The canvas call itself runs only in a browser: Node tests cover what surrounds
  it, not the pixels it produces.
- A heavy image of at most 2200 pixels that encoding does not make 10 % smaller
  has nothing to offer: going below 2200 pixels, digits start to be mistaken.
- A reduced PDF document's coordinates move by at most 0.01 point.
- A JPEG a PDF document wraps in a second filter keeps its Exif data: reading it
  takes undoing that filter, for a form hardly any PDF uses.

## Compliance

A change is compliant with this ADR when:

- the canvas is used only in its own file under `src/io/`;
- the size is in `config/document-sizes.json` only, which the build refuses unless
  it holds it, more than zero;
- an image the Claimant did not reduce keeps its pixels as added in the report
  document, one reduced has a long side of at most 2200 pixels, and no JPEG in it,
  a JPEG of a copied page included, holds Exif data, but for one under a second
  filter;
- tests read a reduced PDF document back and find the same pages, sizes, text,
  links and form fields, images of at most 2200 pixels, and each shape, drawn from
  where it is kept, within 0.01 point of where it was;
- tests check that a bank statement's shapes stay on its pages, even when another
  document holds the same file, that Restore gives back the bytes of the file added,
  and that the draft holds the file added and not the reduced file, for an image
  as for a PDF document;
- a document is called heavy, and offered to be reduced, only by the rule above,
  in one place.
