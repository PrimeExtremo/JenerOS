#!/usr/bin/env bash
# Serves ~/jeneros-updates on port 8000 so JenerOS VMs can download updates.
# Dev only; the real update server will live on jener.dev.
set -euo pipefail
DIR="${UPDATES_DIR:-$HOME/jeneros-updates}"
mkdir -p "$DIR"
exec python3 -m http.server 8000 --directory "$DIR"
