# ADR 0004: Code quality with Vitest, Biome and a SonarQube quality gate

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

Strict TypeScript is not enough of a gate. The report document is what
McSCert's administration reimburses from: a wrong total, a receipt filed
under the wrong label or a missing page is a real cost. Each rule of the
specification needs a test, and a shared, visible measure of quality is worth
more than individual review effort.

ADR 0001's exact pinning makes every dependency a maintenance cost, so the
tool set is small.

Options considered:

- **Test runner.** Vitest, which shares `vite.config.ts` with the build and
  supports watch mode, coverage and DOM environments; or Node's built-in
  runner, which has weaker DOM and coverage support.
- **Linter and formatter.** ESLint with typescript-eslint and Prettier, the
  most complete and the largest dependency tree; Biome, one package that
  lints and formats; oxlint, linter only.
- **Analysis.** SonarQube Cloud, driven from CI so that coverage is included;
  Sonar's automatic analysis, which has no coverage; a self-hosted server,
  which is a service to run.

## Decision

### Tests: Vitest

- `vitest` and `@vitest/coverage-v8` are pinned dev dependencies; tests are
  `*.test.ts` files next to the code, configured in the `test` block of
  `vite.config.ts`.
- Domain and I/O code is tested in Node. The PDF library runs in Node
  (ADR 0006), so the report document is written and read back in tests; the
  draft store is tested against `fake-indexeddb` (pinned).
- UI modules are tested with `happy-dom` (pinned), opted into by a
  `// @vitest-environment happy-dom` first line.
- `npm run test` runs with coverage and fails below **80 %** of lines,
  functions, branches and statements: the same number as the SonarQube gate.

### Business code and test code

`tsconfig.json` is a solution file over two projects sharing
`tsconfig.base.json`: `tsconfig.app.json` is `src/` without the `*.test.ts`
files, with browser and Vite client types only; `tsconfig.test.json` is the
`*.test.ts` files, `vite.config.ts` and `scripts/*.ts`, and is the only one with
Node's types. `npm run typecheck` is `tsc -b`. No business file imports a test
file, `vitest` or a `node:` module.

`tsconfig.base.json` adds `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters` and
`erasableSyntaxOnly` to `strict`, and uses bundler resolution with
`verbatimModuleSyntax` and `allowImportingTsExtensions`.

### Lint and format: Biome

`@biomejs/biome`, pinned, configured in `biome.json`: recommended rules, with
unused imports and variables, explicit `any`, `useConst` and `noNestedTernary`
as errors; two-space indentation, single quotes, no semicolons, trailing
commas, 100-column lines, sorted imports. Whatever Biome produces is the
style.

### ADR checks

`scripts/check-adr.sh` holds every ADR rule a grep or a Node one-liner can
verify, run by `npm run check` after a build.

### Gates

- `npm run verify` runs type-check, lint, tests, build and ADR checks, in that
  order: it is the definition of green.
- CI (`.github/workflows/ci.yml`) runs the same steps on every push to a
  branch and every pull request. A release tag is not a branch: the release
  workflow runs `npm run verify` on it (ADR 0003).

### SonarQube Cloud

- The CI job runs `SonarSource/sonarqube-scan-action`, pinned to a full commit
  SHA, after the tests, with full git history for new-code detection.
- `sonar-project.properties` sets the sources and tests (`src/`, tests being
  `*.test.ts`), both compiler projects and the LCOV report. It holds **no
  project key and no organization**: CI passes them from the repository
  secrets `SONAR_PROJECT_KEY` and `SONAR_ORGANIZATION`, with the token in
  `SONAR_TOKEN`. The step is skipped when `SONAR_TOKEN` is absent, so CI stays
  green without a Sonar project. Automatic analysis is switched off on the
  Sonar side.
- **Quality gate: Sonar way**, on new code: coverage at least 80 %, duplicated
  lines at most 3 %, A ratings for reliability, security and maintainability.
  Making the gate block merges is a branch-protection setting.

## Consequences

**Positive**

- Three pinned packages cover tests, coverage, lint and format.
- The report document is checked by reading it back, not by eye.
- The Sonar project is configured in the repository's secrets, not in its
  files.

**Negative / accepted trade-offs**

- Biome's type-aware rules are less complete than typescript-eslint's.
- `noUncheckedIndexedAccess` makes indexing more verbose; that is the point.
- The draft store is tested against a fake; how each browser keeps it under
  `file://` is checked by hand (ADR 0008).

## Compliance

A change is compliant with this ADR when:

- `npm run verify` passes;
- every new behaviour in `src/domain/`, `src/io/` and `src/ui/` has a test
  next to it, and every rule of the specification at least one;
- coverage stays at or above 80 % on every metric locally;
- no `biome-ignore` or `@ts-expect-error` is added without a comment saying
  why;
- `tsconfig.app.json` lists neither `node` nor Vitest in `types`, and no file
  of the app project (`src/` without the `*.test.ts` files) imports a test
  file, `vitest` or a `node:` module; the test files, `vite.config.ts` and
  `scripts/*.ts` may use Node;
- `sonar-project.properties` holds no `sonar.projectKey` and no
  `sonar.organization`, and no other file sets `sonar.*` except the CI step
  passing those two from secrets.
