# ADR 0003: Distribute builds through GitHub Releases

- **Status:** Accepted
- **Date:** 2026-11-07
- **Deciders:** Sébastien Mosser

## Context

ADR 0001 makes the deliverable a single HTML file that runs from `file://`. The
system does not need to be hosted: it needs to be handed to claimants as a
file. The repository is private.

Options considered:

- **GitHub Pages or another static host.** Gives a URL, but makes the built
  application public, or needs a paid plan for a private repository, and the
  Claimant would still be better off keeping the file.
- **A shared drive** filled from CI. Needs credentials for the drive in CI and
  someone to keep them valid.
- **GitHub Releases.** Needs no credential beyond the workflow's own token, and
  gives every version a permanent download URL.

## Decision

Builds are distributed as **assets attached to GitHub Releases**, produced by
`.github/workflows/release.yml`.

- **Trigger.** Pushing a tag `vX.Y.Z` creates the release. Nothing else creates
  one.
- **Version consistency.** The tag equals the `version` of `package.json` (tag
  `v1.2.0` ⇔ version `1.2.0`); the workflow fails otherwise, so a release starts
  with a version bump commit.
- **Artefact.** One asset, `macreport-vX.Y.Z.html`, the file the build emits
  under the name the build gives it. Release notes are generated from the
  commits since the previous tag.
- **Immutability.** A release is never edited or re-uploaded; a broken release
  is followed by a new version.
- **Supply chain.** The workflow uses the repository's `GITHUB_TOKEN` with
  `contents: write` and first-party `actions/*` steps only, each pinned to a
  full commit SHA with the version in a trailing comment. It publishes with
  the `gh` CLI preinstalled on the runner.
- **Reproducibility.** The workflow installs Node from `.nvmrc` and
  dependencies with `npm ci`.

## Consequences

**Positive**

- No infrastructure, no external credential, no cost.
- Each version has a stable URL and file name, next to the source.

**Negative / accepted trade-offs**

- Only people with access to the repository can download a release; anyone
  else receives the file from someone who has.
- A new release has a new file name; the draft kept by one version may not be
  seen by the next (ADR 0008).
- Some mail clients treat an attached HTML file as suspicious.

## Compliance

A change is compliant with this ADR when:

- `.github/workflows/release.yml` triggers only on `vX.Y.Z` tags, checks the tag
  against `package.json`, and attaches exactly one asset named
  `macreport-vX.Y.Z.html`;
- every action in the workflows is a first-party `actions/*` step pinned to a
  full commit SHA, except the SonarQube scan of ADR 0004, pinned the same way;
- no other workflow or script creates, edits or deletes releases;
- a version bump of `package.json` accompanies every tag.
