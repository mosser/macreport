#!/usr/bin/env bash
# The ADR rules a grep or a Node one-liner can verify. Run after a build.
set -uo pipefail
cd "$(dirname "$0")/.."

failures=0
fail() { echo "ADR check failed: $*" >&2; failures=$((failures + 1)); }

business=$(find src -name '*.ts' ! -name '*.test.ts')
version=$(node -p "require('./package.json').version")

# ADR 0001: one file, named after the version; no network API; TypeScript only.
built=$(ls dist 2>/dev/null)
[ "$built" = "macreport-v${version}.html" ] || fail "dist/ must hold exactly macreport-v${version}.html, holds: ${built:-nothing}"
grep -nE '\bimport\(|\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon' $business && fail "network API or dynamic import() in src/"
find src -type f ! -name '*.ts' ! -name 'style.css' ! -path 'src/assets/*' | grep . && fail "src/ holds a file that is not TypeScript, style.css or an asset"
grep -q '"strict": true' tsconfig.base.json || fail "tsconfig.base.json must keep strict"
grep -q 'viteSingleFile()' vite.config.ts || fail "vite.config.ts must use viteSingleFile()"
grep -q "base: './'" vite.config.ts || fail "vite.config.ts must set base: './'"
node -e "
const p = require('./package.json')
const all = { ...p.dependencies, ...p.devDependencies }
const loose = Object.entries(all).filter(([, v]) => !/^\d+\.\d+\.\d+$/.test(v))
if (loose.length) { console.error(loose); process.exit(1) }
" || fail "package.json must declare exact versions only"
[ -f package-lock.json ] || fail "package-lock.json must be committed"
for lock in pnpm-lock.yaml yarn.lock bun.lock bun.lockb; do [ -e "$lock" ] && fail "$lock must not exist"; done
grep -q '^save-exact=true$' .npmrc || fail ".npmrc must set save-exact=true"
grep -q '^engine-strict=true$' .npmrc || fail ".npmrc must set engine-strict=true"
[ -f .nvmrc ] || fail ".nvmrc must exist"

# ADR 0002: colour literals only in the palette block of style.css.
grep -nEi '#[0-9a-f]{3,8}\b|rgba?\( *[0-9]|hsla?\( *[0-9]' $(find src -name '*.ts') && fail "colour literal outside src/style.css"
awk '/palette:start/{inside=1} /palette:end/{inside=0} !inside && /#[0-9A-Fa-f]{3,8}\b|rgba?\(/' src/style.css | grep . && fail "colour literal outside the palette block of src/style.css"

# ADR 0004: business code imports no test, vitest or node: module; no TODO; sonar keys from CI.
grep -nE "from '(vitest|node:[^']*)'|from '[^']*\.test(\.ts)?'" $business && fail "business code imports a test, vitest or node: module"
grep -rn 'TODO' src scripts --exclude=check-adr.sh && fail "TODO in the code"
grep -nE 'biome-ignore[^:]*$' $(find src -name '*.ts') && fail "biome-ignore without a reason"
grep -nE '^sonar\.(projectKey|organization)' sonar-project.properties && fail "sonar-project.properties must not set the project key or organization"

# ADR 0006: the PDF library is imported only under src/io/.
grep -lE "from '@cantoo/(pdf-lib|fontkit)'" $business | grep -v '^src/io/' && fail "PDF library imported outside src/io/"

# ADR 0007: the domain imports nothing from io, ui or a PDF library, and uses no browser API.
grep -nE "from '\.\./(io|ui)/|from '@cantoo/|\b(window|navigator|indexedDB|globalThis)\." $(find src/domain -name '*.ts' ! -name '*.test.ts') && fail "src/domain/ depends on io, ui, a PDF library or the browser"

# ADR 0008: no storage but IndexedDB, and IndexedDB only in the draft store.
grep -nE 'localStorage|sessionStorage|document\.cookie|caches\.' $(find src -name '*.ts') && fail "browser storage other than IndexedDB"
grep -ln 'indexedDB' $business | grep -v '^src/io/draft-store.ts$' && fail "IndexedDB used outside src/io/draft-store.ts"

# ADR 0009: add and save, never upload or download.
grep -rniE 'upload|download' src docs/specs | grep -v '^src/io/save.ts:' && fail "\"upload\" or \"download\" in src/ or docs/specs/"
grep -niE 'upload|download' src/io/save.ts 2>/dev/null | grep -viE 'download =|`download`|\bdownload attribute' && fail "src/io/save.ts may only set the download attribute"

if [ "$failures" -gt 0 ]; then
  echo "$failures ADR check(s) failed" >&2
  exit 1
fi
echo "ADR checks passed"
