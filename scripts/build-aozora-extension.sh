#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT/aozora-style/extension"
OUT_DIR="$ROOT/aozora-style/dist"
VERSION="$(python3 -c "import json; print(json.load(open('$EXT_DIR/manifest.json'))['version'])")"
ZIP_NAME="aozora-style-v${VERSION}.zip"

python3 "$ROOT/scripts/build-aozora-extension-icons.py"
mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR/$ZIP_NAME"

(
  cd "$EXT_DIR"
  zip -r "$OUT_DIR/$ZIP_NAME" . \
    -x "*.DS_Store" \
    -x "README.md"
)

echo "built $OUT_DIR/$ZIP_NAME"
