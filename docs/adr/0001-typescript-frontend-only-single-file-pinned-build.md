# ADR 0001: TypeScript, front-end only, single-file Vite build with pinned dependencies

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Sébastien Mosser

## Context

The system prepares one expense report at a time, on the Claimant's computer,
from receipts and bank statements that are personal and financial data. Its
functional specification lives in `docs/specs/`, and architectural decisions
are recorded here in `docs/adr/`.

Three choices come first, because every other decision depends on them: the
implementation language, whether the system has a server-side component, and
how it is built and its dependencies managed.

The project is maintained by a single developer and must stay reproducible
over time: a checkout made months apart builds to the same result, whatever
happens to be installed on the machine.

Options considered for the architecture:

- **A hosted web application with a server** that stores the reports. Gives
  access from any computer, but the receipts and bank statements of every
  claimant then sit on a server someone must secure, back up and answer for.
- **A static site** served from a host. No server-held state, but the system
  depends on a host being up, and the Claimant has to trust that the page they
  load is the one that was built.
- **One HTML file opened from disk.** Nothing to host and nothing sent
  anywhere; the file can be kept, copied and versioned like any document.

## Decision

### 1. Language: TypeScript

All application code is written in **TypeScript** with `strict` mode enabled.
Plain JavaScript files are not accepted in `src/`. Type-checking is part of the
build and a type error fails the build.

### 2. Architecture: client-side only, delivered as a single file

The system is a **front-end only web application**. It runs entirely in the
browser, and the production build is **one self-contained HTML file**,
`dist/macreport-vX.Y.Z.html` (the `version` of `package.json`): all JavaScript,
CSS, fonts and images are inlined into it, and so is the configuration, JSON
files under `config/` (the per diem rates) imported when the system is built. That file works when opened
directly from disk (`file://`), and equally from any static file host: the
release workflow serves that same file, unchanged, as the `index.html` of the
project's GitHub Pages site (ADR 0003).

- There is **no backend**: no server-side code, no database, no server-held
  state, no proxy and no serverless function.
- **Nothing crosses a network.** The page fetches nothing at runtime, by
  relative URL or otherwise, and sends nothing. Files are read where the
  Claimant hands them over, and the report document is written in the
  browser (ADR 0009). A link to McMaster's policy is followed only by the reader,
  in a tab of its own (ADR 0012).
- Persistence is on the client only, and best effort (ADR 0008).

### 3. Build system: Vite, with every dependency pinned

- **Build tool:** [Vite](https://vite.dev/), scaffolded as a vanilla TypeScript
  project (ADR 0005 keeps it framework-free).
- **Single-file output:** `vite-plugin-singlefile`, configured in
  `vite.config.ts` with `base: './'`, inlines every chunk and asset into one
  page. A small plugin in the same file names that page after the version it
  was built from, so a copy of the file always says which version it is;
  `dist/` holds no `index.html`. Browsers block module *files* over `file://`
  but run inline module code that imports nothing, which is why the bundle is
  one chunk: no code splitting, no dynamic `import()`.
- **Package manager:** npm is the reference tool and `package-lock.json` the
  only committed lockfile. Installs are frozen-lockfile installs (`npm ci`).
- **Runtime version:** Node.js 26, the active LTS line, pinned in `.nvmrc` and
  declared in the `engines` field of `package.json`. `engine-strict=true` in
  `.npmrc` makes an unsupported Node version fail the install.
- **TypeScript** is pinned to the 6.0 line, as the official Vite template is.
  The native compiler (TypeScript 7) is a deliberate bump, not a drive-by.

Dependencies are pinned at two levels:

| Level | Mechanism | Rule |
|---|---|---|
| Declared versions | `.npmrc` with `save-exact=true` | `package.json` holds exact versions only: no `^`, `~`, range, `latest` or git URL. |
| Resolved tree | `package-lock.json` committed | `npm ci` in CI and on a fresh checkout, never a resolving install. |

A dependency bump is its own commit, touching `package.json` and
`package-lock.json` only. `dist/` and `node_modules/` are never committed.

## Consequences

**Positive**

- The receipts and bank statements never leave the Claimant's computer, so
  there is nothing to secure on a server and nothing to declare about one.
- The deliverable is one file: opened by double-click, kept with the
  Claimant's documents, copied to a colleague, at no operating cost.
- Exact pinning, a committed lockfile and `npm ci` mean a build today and a
  build in a year produce the same file.

**Negative / accepted trade-offs**

- Dependency updates do not happen by themselves; security fixes arrive only
  with a deliberate bump.
- Everything ships in one file: no lazy loading, and every inlined library,
  font or image weighs on the page. The PDF library, its fonts (ADR 0006) and
  the logos are the largest parts and are kept to what is needed.
- The report is prepared in one browser on one computer; there is no access
  from elsewhere (ADR 0008).

## Compliance

A change is compliant with this ADR when:

- `src/` contains only `.ts` files besides `style.css` and imported assets,
  configuration lives in JSON files under `config/`, imported, and
  `tsconfig.base.json` keeps `"strict": true`;
- the repository contains no server-side code and no deployment manifest for
  one;
- `npm run build` emits exactly one file, `dist/macreport-vX.Y.Z.html` with the
  `version` of `package.json`, that opens from `file://`; `vite.config.ts` keeps
  `viteSingleFile()` and `base: './'`;
- `src/` contains no dynamic `import()`, no `fetch()`, no `XMLHttpRequest`, no
  `WebSocket` and no `navigator.sendBeacon`;
- `package.json` declares exact versions only, `package-lock.json` is committed
  and in sync, no other lockfile is committed, `.npmrc` sets `save-exact=true`
  and `engine-strict=true`, and `.nvmrc` is present;
- CI installs with `npm ci`.
