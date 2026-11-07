# McSCert Expense Report

Prepares an expense report for the McMaster Centre for Software Certification
(McSCert): enter the report and its expenses, add receipts and bank
statements, and save one PDF holding a cover in place of the McSCert Expense
Report Template, then every supporting document, sorted into sections.

It is one HTML file that runs in the browser, from disk: there is no server,
nothing to install, and nothing leaves the computer.

Open the latest version at <https://mosser.github.io/macreport/>, or save
`macreport-vX.Y.Z.html` from the
[releases](https://github.com/mosser/macreport/releases) and open it from disk.

## Status

One report at a time: its expenses, each with its receipt and its bank
statement, its travel justifications and additional documents, saved as one
PDF. See
[`CHANGELOG.md`](CHANGELOG.md) for what it does and does not do yet.

- Specification: [`docs/specs/`](docs/specs/), starting with the
  [glossary](docs/specs/domain-model.md) and
  [the steps](docs/specs/prepare-an-expense-report.md).
- Architecture decisions: [`docs/adr/`](docs/adr/).

## Development

Node 26 (`.nvmrc`), then:

```sh
npm ci              # install from the lockfile
npm run dev         # Vite dev server
npm run verify      # typecheck + lint + test + build + ADR checks
npm run build       # dist/macreport-vX.Y.Z.html
```

## Releasing

From an up-to-date, clean `main`, with the changes listed under
`[Unreleased]` in `CHANGELOG.md`:

```sh
scripts/release.sh vX.Y.Z
```

The script refuses a version that exists already, sets it in `package.json`,
dates the CHANGELOG section, runs `npm run verify`, commits and tags, then
pushes `main` and the tag once confirmed. The tag publishes the GitHub release,
with that CHANGELOG section as its notes, and deploys the file to GitHub Pages.

## Author

Sébastien Mosser, McMaster University.
