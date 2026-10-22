#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact page to capture.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR for the final screenshots.}"

case "$CAPTURE_DIR" in
  /*) ;;
  *) CAPTURE_DIR="$(pwd -P)/$CAPTURE_DIR" ;;
esac

/usr/bin/time -p mkdir -p "$CAPTURE_DIR"

set +e
/usr/bin/time -p node "$PROJECT_DIR/scripts/capture.mjs"
status=$?
set -e

exit "$status"
