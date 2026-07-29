#!/bin/sh
set -e

# Refuse to start on incomplete config. Without this the server boots and only
# fails once someone tries to sign in, which reads as a broken app rather than
# a missing setting.
node /app/scripts/check-env.mjs

# A fresh volume has no schema; migrations are idempotent so this is safe on
# every boot, not just the first.
node /app/scripts/migrate.mjs

exec "$@"
