#!/bin/sh
# Restore fx-engine.js, styles.css and index.html from the snapshot in full/.
# Refuses to run without --yes. Saves the current files to pre-restore/ first,
# so the restore itself can be undone.

set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(dirname -- "$DIR")
FILES="fx-engine.js styles.css index.html"

if [ "${1:-}" != "--yes" ]; then
  echo "This overwrites the following files in $ROOT:"
  for f in $FILES; do echo "  $f"; done
  echo
  echo "Current versions would be saved to $DIR/pre-restore/ first."
  echo "Re-run with --yes to proceed:  $0 --yes"
  exit 1
fi

for f in $FILES; do
  if [ ! -f "$DIR/full/$f" ]; then
    echo "missing snapshot: $DIR/full/$f" >&2
    exit 1
  fi
done

mkdir -p "$DIR/pre-restore"
for f in $FILES; do
  [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$DIR/pre-restore/$f"
done
echo "saved current files to $DIR/pre-restore/"

for f in $FILES; do
  cp "$DIR/full/$f" "$ROOT/$f"
  echo "restored $f"
done

echo
echo "Now run:"
echo "  node --check $ROOT/fx-engine.js && node --check $ROOT/script.js && git -C $ROOT diff --check"
