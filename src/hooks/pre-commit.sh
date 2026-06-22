#!/bin/sh
# conductor-harness-managed
set -eu

"$CONDUCTOR_HARNESS_NODE" "$CONDUCTOR_HARNESS_CLI" redlines check \
  --repo "$CONDUCTOR_HARNESS_REPO" \
  --run-root "$CONDUCTOR_HARNESS_RUN_ROOT"

if [ -n "${CONDUCTOR_HARNESS_UPSTREAM:-}" ] && [ -x "$CONDUCTOR_HARNESS_UPSTREAM" ]; then
  exec "$CONDUCTOR_HARNESS_UPSTREAM" "$@"
fi
