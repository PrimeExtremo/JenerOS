#!/usr/bin/env bash
# Copies this repo into the build VM at ~/jeneros (replacing what's there).
# Run from Windows (Git Bash) or Linux:  ./[OS]/sync-to-vm.sh [ssh-host]
set -euo pipefail

HOST="${1:-jeneros-build}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$ROOT")"
NAME="$(basename "$ROOT")"

tar -czf - -C "$PARENT" \
    --exclude="$NAME/.git" --exclude="$NAME/[[]OS]/out" --exclude="$NAME/[[]OS]/build" \
    --exclude="$NAME/[[]OS]/mkosi.cache" --exclude="$NAME/[[]OS]/mkosi.tools" \
    "$NAME" |
    ssh "$HOST" "rm -rf ~/jeneros && mkdir -p ~/jeneros && tar -xzf - -C ~/jeneros --strip-components=1 && chmod +x ~/jeneros/'[OS]'/*.sh"
echo "Synced to $HOST:~/jeneros"
