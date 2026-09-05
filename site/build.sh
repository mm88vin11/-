#!/usr/bin/env bash
# Reassembles the shippable single-file page from the editable body and the
# two base64 asset blobs that are kept out of the working file.
set -euo pipefail
cd "$(dirname "$0")"
out="${1:-dist/index.html}"
mkdir -p "$(dirname "$out")"
cat build/00-doctype.txt build/01-head-resources.txt body.html build/99-tail-resources.txt build/zz-close.txt > "$out"
echo "built $out ($(wc -c < "$out") bytes)"
