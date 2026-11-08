# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

`macreport` prepares one expense report at a time for the McMaster Centre for
Software Certification (McSCert). The Claimant enters the report's fields and
its expenses, adds each expense's receipts and bank statements and the
report's additional documents (PDF, JPEG or PNG), and saves **one PDF**: a
cover that takes the place of the McSCert Expense Report Template, then the
documents, one section per kind, each opened by a section page. An expense
without a receipt gets a pre-filled Missing Receipt Authorization Form for
the Claimant to sign.

It is a client-side web application in TypeScript, front-end only, delivered
as **one self-contained `dist/macreport-vX.Y.Z.html`** that opens from
`file://`. Nothing crosses a network. See
[ADR 0001](docs/adr/0001-typescript-frontend-only-single-file-pinned-build.md).

**Current state:** v0.2.0, plus the unreleased list of expenses and per
diems: one report, its expenses listed by date, each added, changed or
removed, with one receipt and one bank statement, chosen again among those
already in the report, and a foreign amount and currency; the locations and
per diems of a business travel (meals per day, domestic or international);
travel justifications and additional documents, every document named, saved
as the report document (cover with Entered boxes, per diem rows and a total
by currency, sections, stamps). Not yet built: missing receipts, cash, the
number of pages on the Additional documents step, some links, refusing a
file, and font findings.
The
specification and the ADRs describe the full system; code follows them.

## Where things live

- `docs/specs/`: the functional specification, the source of truth for
  behaviour. `stakeholders.md`, `domain-model.md` (the glossary),
  `prepare-an-expense-report.md` (the four steps and their rules),
  `report-document.md` (the PDF, page by page). Read the relevant spec before
  implementing a feature; if a spec is missing or ambiguous, say so rather than
  guessing. Spec files are short, self-contained, and never cite or link to
  documents outside the repository: a heading, then tables or short
  paragraphs, no preamble.
- `docs/adr/`: Architecture Decision Records, `NNNN-short-title.md`. Sections:
  Status, Date, Deciders, Context (with "Options considered"), Decision,
  Consequences (Positive, Negative / accepted trade-offs), Compliance. ADRs are
  living documents: when a decision changes, amend the ADR in place and update
  its Date line; do not write a superseding ADR. A new ADR is for a new
  decision. An ADR never narrates how the project got here ("until now", "no
  longer", "the first version"); it states the forces that hold today, and a
  rejected approach goes under "Options considered", in the present tense.
- `docs/_*.pdf`: reference forms filled in with personal data (a signature
  among them). Git-ignored; never commit, quote or copy them.

Planned layout of the code (ADR 0005, ADR 0006, ADR 0007, ADR 0008):

```
src/domain/   the object model of a report and its rules: pure, no DOM, no PDF library
src/io/       reading documents, writing the report document (@cantoo/pdf-lib),
              the draft store (IndexedDB), saving a file
src/ui/       the wizard and its four steps: Report, Expenses, Additional documents, Review
src/assets/   McSCert logos, as supplied; fonts/: Noto Sans, cut down, with its licence
src/main.ts   entry point, mounted from index.html
config/       per-diems.json: the per diem rates, inlined at build time
src/style.css McMaster palette tokens and all styling
scripts/      check-adr.sh: the scriptable ADR checks; release.sh and
              release-notes.sh: cutting a release (ADR 0003)
```

## Ground rules

These are constraints, not suggestions. A change that breaks one amends its ADR
first.

### ADR 0001: single file, no network, pinned build

- TypeScript only in `src/`, `strict`. No server-side code, proxy or
  serverless function.
- The build is one file (`vite-plugin-singlefile`, `base: './'`): no dynamic
  `import()`, no `fetch()`, no network API at all; assets are imported from
  `src/` so they are inlined.
- Every dependency is an exact version (`.npmrc`: `save-exact`,
  `engine-strict`). `package-lock.json` committed; `npm ci`, never
  `npm install` on a fresh checkout. A dependency bump is its own commit
  touching `package.json` and `package-lock.json` only.
- Node 26 (LTS), pinned in `.nvmrc` and `engines`. TypeScript on the 6.0 line.

### ADR 0002: McMaster palette, McSCert logo

- Colour literals live only in the palette block of `src/style.css`; the
  interface uses `var(--mac-…)` or `--color-*` roles, and the report document
  takes its colours from the same tokens.
- Maroon dominates, gold is secondary, accents signal. Never gold text on a
  light background. Approved text pairings are tabled in the ADR.
- The McSCert logos are used as supplied, never redrawn or recoloured.

### ADR 0003: releases

- A release is a `vX.Y.Z` tag equal to the `version` of `package.json`, cut
  only by `scripts/release.sh vX.Y.Z` from a clean, up-to-date `main`. The
  workflow attaches `macreport-vX.Y.Z.html`, takes the release notes from the
  `## [X.Y.Z]` section of `CHANGELOG.md` (`scripts/release-notes.sh`), and
  deploys the same file as `index.html` to `https://mosser.github.io/macreport/`.
  Never cut a release unless asked. Actions are pinned to a full commit SHA
  with the version in a comment.

### ADR 0004: quality

- `npm run verify` (typecheck, lint, test, build, ADR checks) is the
  definition of green. Run it before reporting work as done.
- Every new behaviour has a test next to it (`*.test.ts`); every rule of the
  specification has at least one. Coverage floor 80 % on every metric, and
  SonarQube's gate requires 80 % on new code.
- Business code and tests are separate compiler projects
  (`tsconfig.app.json`, `tsconfig.test.json`); business code never imports a
  test file, `vitest` or a `node:` module. Node types in the test project only.
- Biome formats and lints: run `npm run format`. No nested ternaries. No
  `biome-ignore` or `@ts-expect-error` without a reason comment. No `TODO`.
  Throw the specific error class (`TypeError`, `RangeError`).
- `sonar-project.properties` holds no project key or organization: CI passes
  them from the `SONAR_PROJECT_KEY` and `SONAR_ORGANIZATION` secrets.

### ADR 0005: no framework

- Views are rendered with the escaping `html` template of `src/ui/html.ts`;
  `raw()` never wraps text the Claimant typed or a file name. Each screen is a
  `Step`. Clicks change the draft and call `ctx.refresh()`; typed edits update
  the DOM in place and call `ctx.refreshActions()`, so focus is kept.

### ADR 0006: PDF

- `@cantoo/pdf-lib` (with `@cantoo/fontkit`) is the only PDF library,
  imported only under `src/io/`. The report document embeds Noto Sans Regular
  and Bold from `src/assets/fonts/`, subset, and no other font.
  Password-protected PDFs are refused.
- The report document writer draws, copies, paginates, stamps and links; it
  never orders, numbers, labels or totals: the layout comes from the domain.
  Text wraps, never clipped; a generated part longer than a page continues.

### ADR 0007: object model

- `Report`, `Expense`, `Document` and their values are immutable classes in
  `src/domain/` that throw on a broken invariant; changes return `after…`
  copies; expenses refer to documents by reference.
- Names are the glossary's (`docs/specs/domain-model.md`): add the glossary
  line first. One word, one meaning. No abbreviation, no single-letter name.
  Booleans are questions. Every `export` has a doc comment stating its rule in
  the specification's words.
- Findings are worded only in `src/domain/findings.ts`, pinned by exact-string
  tests. `src/domain/` imports nothing from `src/io/` or `src/ui/`.

### ADR 0008: the draft

- Only `src/io/draft-store.ts` touches IndexedDB; nothing uses
  `localStorage`, `sessionStorage`, cookies or the Cache API. Every access is
  guarded and the system works without it. New report deletes everything but
  the claimant's name, position and email.

### ADR 0009: vocabulary

- Files are **added** and the report document is **saved**. "Upload" and
  "download" never appear under `src/` (except the `download` attribute in
  `src/io/save.ts`) nor in `docs/specs/`.

### ADR 0010: the report document

- `docs/specs/report-document.md` is the layout. A change to the layout
  changes that spec in the same commit, and tests read the written PDF back.
- Text the embedded font cannot write is a finding, never replaced silently.
  The system never redacts and never converts currencies.
- The missing receipt authorization reproduces McMaster's wording as the spec
  quotes it; a change of wording changes the spec in the same commit.

## Writing

- **No narrating text**, in the interface or in the report document: no
  sentence that introduces a screen or a section, restates its heading or
  explains how to read it. Text is content, a heading or label, a status, a
  finding, or a notice a decision asks for (the draft notice of ADR 0008, the
  privacy statement of ADR 0005).
- Words are the glossary's, in the interface as in the code.

## Git

- `main`, plus **one development branch at a time**. All work is committed on
  the development branch that is checked out; no other branch is created for a
  task, however small. The next development branch is created only once the
  current one has been merged and deleted.
- `main` receives the development branch through a pull request, when the user
  asks for it. Never commit to `main`, open or merge a pull request, or push a
  tag without being asked.
- Commit subjects are imperative sentences saying what the change does
  (`Refuse a PDF protected by a password`).
- A `CHANGELOG.md` (Keep a Changelog) starts with the first release and is kept
  in step with every user-visible change.

## Commands

Once the project is scaffolded:

```sh
npm ci              # install from the lockfile
npm run dev         # Vite dev server
npm run verify      # typecheck + lint + test + build + ADR checks: the full gate
npm run typecheck   # tsc -b over the app and test projects
npm run lint        # Biome lint + format check
npm run format      # Biome, rewrite files
npm run test        # Vitest once, with coverage and its 80 % floor
npm run coverage    # the same, for SonarQube (lcov in coverage/)
npm run build       # tsc -b, then the single file dist/macreport-vX.Y.Z.html
npm run check       # scripts/check-adr.sh (needs a build first)
scripts/release.sh vX.Y.Z  # cut a release from main (only when asked)
```
