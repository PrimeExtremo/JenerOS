#!/usr/bin/env bash
# Builds [DASHBOARD]/privacy.pdf from the policy text in [DASHBOARD]/privacy.html.
# Run on the build VM (needs weasyprint): ./[DOCS]/privacy-pdf/make.sh
# Re-run whenever the policy text changes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$ROOT/[DOCS]/privacy-pdf"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# The <article> holds the policy; reuse it so the PDF never drifts from the page.
{
    sed -n '1,/<\/header>/p' "$HERE/template.html"
    sed -n '/<article/,/<\/article>/p' "$ROOT/[DASHBOARD]/privacy.html"
    sed -n '/<\/body>/,$p' "$HERE/template.html"
} > "$TMP/privacy.html"
cp "$HERE/print.css" "$ROOT/[DASHBOARD]/fonts/bricolage-grotesque-700.woff2" "$TMP/"
weasyprint "$TMP/privacy.html" "$ROOT/[DASHBOARD]/privacy.pdf"
echo "Wrote [DASHBOARD]/privacy.pdf"
