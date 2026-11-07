# ADR 0003: Distribute builds through GitHub Releases and GitHub Pages

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

ADR 0001 makes the deliverable a single HTML file that runs from `file://`. The
system does not need to be hosted: it needs to reach claimants. A file can be
handed over; an address is easier to give, and always leads to the latest
version. The repository is public.

Release notes are read by claimants and by whoever approves their reports,
not by developers. `CHANGELOG.md` already describes every user-visible change
in their words (Keep a Changelog); commit subjects describe code.

Options considered:

- **GitHub Releases.** Needs no credential beyond the workflow's own token, and
  gives every version a permanent file URL.
- **GitHub Pages at `mosser.github.io/macreport/`.** Gives an address that
  always serves the latest release, from the same origin for every version.
  That origin is shared with the owner's user site and every other project
  page of the account: browser storage is per origin, so a script on any of
  those pages can read the draft (ADR 0008), bank statements included.
- **GitHub Pages under a domain of its own.** An origin no other page uses,
  but a domain to buy, a DNS record to keep and a certificate to watch.
- **A shared drive** filled from CI. Needs credentials for the drive in CI and
  someone to keep them valid.
- **Release notes generated from the commits** since the previous tag. No
  effort, but written for developers, and a list of commits rather than what
  changed for a claimant.
- **Release notes taken from `CHANGELOG.md`.** Written once, for users, as part
  of each change.

## Decision

Every release is a **GitHub Release** with the file attached, and the same
file is served by **GitHub Pages** at `https://mosser.github.io/macreport/`.
Both come from `.github/workflows/release.yml`.

- **Cutting a release.** `scripts/release.sh vX.Y.Z`, run on an up-to-date,
  clean `main`, is the only way to start one. It refuses a version that is not
  `vX.Y.Z`, that is not higher than the latest release, or that already exists as
  a tag (locally or on `origin`), as a GitHub release, or as a section of
  `CHANGELOG.md`; and it refuses an empty `[Unreleased]` section. It sets the
  version in `package.json` and `package-lock.json`, renames `[Unreleased]` to
  `[X.Y.Z] - YYYY-MM-DD` under a new empty `[Unreleased]`, runs
  `npm run verify`, commits `Release vX.Y.Z`, tags it, and, once confirmed,
  pushes `main` and the tag together (`git push --atomic`). On a failure or a
  refusal, `main` is put back as it was.
- **Trigger.** Pushing a tag `vX.Y.Z` creates the release. Nothing else creates
  one.
- **Version consistency.** The tag equals the `version` of `package.json` (tag
  `v1.2.0` ⇔ version `1.2.0`); the workflow fails otherwise.
- **Release notes.** The section `## [X.Y.Z]` of `CHANGELOG.md`, as printed by
  `scripts/release-notes.sh X.Y.Z`. The workflow fails when the section is
  missing or empty.
- **Artefact.** One asset, `macreport-vX.Y.Z.html`, the file the build emits
  under the name the build gives it.
- **Pages.** Once the release is published, a second job fetches its asset and
  deploys it, unchanged, as the `index.html` of the site. The site always
  serves the latest release. The `github-pages` environment accepts
  deployments from `main` and from tags `v*.*.*`.
- **Immutability.** A release is never edited or re-uploaded; a broken release
  is followed by a new version.
- **Supply chain.** The workflow grants no permission at its top level. The
  release job has `contents: write`; the Pages job has `contents: read`,
  `pages: write` and `id-token: write`. Both use the repository's
  `GITHUB_TOKEN` and first-party `actions/*` steps only, each pinned to a full
  commit SHA with the version in a trailing comment, and publish with the `gh`
  CLI preinstalled on the runner.
- **Reproducibility.** The workflow installs Node from `.nvmrc` and
  dependencies with `npm ci`.

## Consequences

**Positive**

- No infrastructure, no external credential, no cost.
- One address to give, always the latest version; each version also keeps a
  stable file URL and file name, next to the source.
- On the site, the origin does not change between versions, so a new version
  finds the draft an earlier one kept (ADR 0008).
- Release notes say what changed for claimants, in the words of the
  specification, and cannot be forgotten: no section, no release.

**Negative / accepted trade-offs**

- The site shares its origin with the owner's other GitHub Pages sites. A
  script on any of them can read the draft kept by the site. Those sites are
  the owner's own, and the file opened from disk is not affected.
- The site changes under a claimant who is preparing a report: the next
  opening runs the new version on the draft the old one kept.
- A new release has a new file name; the draft kept by one downloaded file may
  not be seen by the next (ADR 0008).
- Some mail clients treat an attached HTML file as suspicious; the address
  avoids sending one.

## Compliance

A change is compliant with this ADR when:

- `.github/workflows/release.yml` triggers only on `vX.Y.Z` tags, checks the tag
  against `package.json`, takes the release notes from `CHANGELOG.md` with
  `scripts/release-notes.sh`, attaches exactly one asset named
  `macreport-vX.Y.Z.html`, and deploys that asset as `index.html` to GitHub
  Pages only after the release is published;
- every action in the workflows is a first-party `actions/*` step pinned to a
  full commit SHA, except the SonarQube scan of ADR 0004, pinned the same way;
- no other workflow or script creates, edits or deletes releases, or deploys
  the site;
- a release commit `Release vX.Y.Z`, made by `scripts/release.sh`, carries the
  version bump and the CHANGELOG section of every tag.
