#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd -P)"
PORT="${PORT:-3000}"
WEB_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/tmp}/omgithub-web}"
DIST_DIR="$PROJECT_DIR/dist"

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  echo "PORT must be an integer between 1 and 65535." >&2
  exit 1
fi

timed() {
  /usr/bin/time -p "$@"
}

needs_install=false
if [[ ! -x node_modules/.bin/vite ]]; then
  needs_install=true
elif [[ package.json -nt node_modules/.bin/vite ]]; then
  needs_install=true
elif [[ -f package-lock.json && package-lock.json -nt node_modules/.bin/vite ]]; then
  needs_install=true
fi

if [[ "$needs_install" == true ]]; then
  if [[ -f package-lock.json ]]; then
    timed npm ci --no-audit --no-fund
  else
    timed npm install --no-audit --no-fund
  fi
else
  echo "Dependencies are current; skipping install."
fi

timed npm run build

timed mkdir -p "$WEB_DIR"
timed node -e '
  const fs = require("node:fs")
  const path = require("node:path")
  const [web, project, directory] = process.argv.slice(1)
  fs.writeFileSync(path.join(web, "deployment-output.json"), JSON.stringify({ project, directory }) + "\n")
' "$WEB_DIR" "$PROJECT_DIR" "$DIST_DIR"

echo "Serving $DIST_DIR on 0.0.0.0:$PORT (game + social hub API)"
exec /usr/bin/time -p env PORT="$PORT" WEB_ROOT="$DIST_DIR" node server/index.js
