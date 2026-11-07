# McSCert Expense Report

Prepares an expense report for the McMaster Centre for Software Certification
(McSCert): enter the report and its expenses, add receipts and bank
statements, and save one PDF holding a cover in place of the McSCert Expense
Report Template, then every supporting document, sorted into sections.

It is one HTML file that runs in the browser, from disk: there is no server,
nothing to install, and nothing leaves the computer.

## Status

Version 0.1.0 is a minimal viable product: one report, one expense with its
receipt and its bank statement, saved as one PDF. See
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

## Author

Sébastien Mosser, McMaster University.
