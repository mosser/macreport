#!/usr/bin/env bash
# Prints the body of one section of CHANGELOG.md, the release notes of a
# version (ADR 0003): release-notes.sh 1.2.0, or release-notes.sh Unreleased.
# Fails when the section is missing or holds nothing but blank lines.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <X.Y.Z | Unreleased>" >&2
  exit 2
fi

status=0
awk -v heading="## [$1]" '
  function opens(line) {
    return index(line, heading) == 1 && (length(line) == length(heading) || substr(line, length(heading) + 1, 1) == " ")
  }
  !found && opens($0) { inside = 1; found = 1; next }
  inside && (/^## / || /^\[[^]]+\]: /) { inside = 0 }
  inside {
    lines[++count] = $0
    if ($0 ~ /[^[:space:]]/) { if (!first) first = count; last = count }
  }
  END {
    if (!found) exit 3
    if (!first) exit 4
    for (i = first; i <= last; i++) print lines[i]
  }
' CHANGELOG.md || status=$?

case "$status" in
  0) ;;
  3) echo "CHANGELOG.md has no section [$1]" >&2; exit 1 ;;
  4) echo "The section [$1] of CHANGELOG.md is empty" >&2; exit 1 ;;
  *) exit "$status" ;;
esac
