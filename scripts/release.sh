#!/usr/bin/env bash
# Cuts a release (ADR 0003): release.sh vX.Y.Z
#
# From an up-to-date, clean main: sets the version in package.json and
# package-lock.json, turns the [Unreleased] section of CHANGELOG.md into
# [X.Y.Z], runs the full gate, commits "Release vX.Y.Z", tags it, and, once
# confirmed, pushes main and the tag together. The tag starts the release
# workflow, which publishes the GitHub release and the GitHub Pages site.
set -euo pipefail
cd "$(dirname "$0")/.."

die() { echo "release: $*" >&2; exit 1; }

[ "$#" -eq 1 ] || die "usage: $0 vX.Y.Z"
tag=$1
[[ "$tag" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || die "$tag is not of the form vX.Y.Z"
version=${tag#v}

# Tools.
for tool in git node npm gh; do
  command -v "$tool" >/dev/null || die "$tool is not installed"
done
wanted_node=$(cat .nvmrc)
[ "$(node -p 'process.versions.node.split(".")[0]')" = "$wanted_node" ] || die "Node $wanted_node is required (.nvmrc), found $(node --version)"

# The working copy: main, clean, level with origin/main.
[ "$(git symbolic-ref --short HEAD 2>/dev/null)" = main ] || die "releases are cut from main"
[ -z "$(git status --porcelain)" ] || die "the working tree is not clean"
git fetch --quiet --tags origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "main is not level with origin/main"

# The version is new.
git rev-parse --quiet --verify "refs/tags/$tag" >/dev/null && die "the tag $tag already exists"
[ -z "$(git ls-remote --tags origin "refs/tags/$tag")" ] || die "the tag $tag already exists on origin"
gh release view "$tag" >/dev/null 2>&1 && die "the GitHub release $tag already exists"
bash scripts/release-notes.sh "$version" >/dev/null 2>&1 && die "CHANGELOG.md already has a section [$version]"
current=$(node -p "require('./package.json').version")
node -e '
const [next, current] = process.argv.slice(1).map((v) => v.split(".").map(Number))
const order = next.map((part, i) => part - current[i]).find((d) => d !== 0) ?? 0
process.exit(order > 0 ? 0 : 1)
' "$version" "$current" || die "$version is not higher than the current version $current"

# Something to release.
bash scripts/release-notes.sh Unreleased >/dev/null || die "nothing to release"

# Prepare the release commit; undo everything if a step fails or the push is declined.
start=$(git rev-parse HEAD)
undo() {
  git tag --delete "$tag" >/dev/null 2>&1 || true
  git reset --quiet --hard "$start"
}
trap 'echo "release: failed, main is back at ${start:0:7}" >&2; undo' ERR

npm version "$version" --no-git-tag-version >/dev/null
today=$(date +%Y-%m-%d)
awk -v section="## [$version] - $today" '
  !done && $0 == "## [Unreleased]" { print; print ""; print section; done = 1; next }
  { print }
' CHANGELOG.md >CHANGELOG.md.next
mv CHANGELOG.md.next CHANGELOG.md
notes=$(bash scripts/release-notes.sh "$version")

npm run verify

git add package.json package-lock.json CHANGELOG.md
git commit --quiet -m "Release $tag"
git tag --annotate "$tag" -m "$tag"
trap - ERR

echo
git show --stat --format='%h %s' HEAD
echo
echo "Release notes of $tag:"
echo "$notes" | sed 's/^/  | /'
echo
read -r -p "Push main and $tag to origin? [y/N] " answer
if [ "$answer" != y ] && [ "$answer" != Y ]; then
  undo
  echo "release: not pushed, main is back at ${start:0:7}"
  exit 1
fi

git push --atomic origin main "$tag"
echo "release: $tag pushed; the release workflow publishes it:"
echo "  $(gh repo view --json url --jq .url)/actions/workflows/release.yml"
