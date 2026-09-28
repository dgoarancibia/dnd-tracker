#!/usr/bin/env bash
# Empaqueta TipTap en un solo archivo IIFE (global TT), sin CDN, para que
# Hojas funcione offline. Las versiones quedan fijadas en package.json.
set -euo pipefail
cd "$(dirname "$0")"
npm install --silent
VERS=$(node -p "JSON.parse(require('fs').readFileSync('node_modules/@tiptap/core/package.json')).version")
npx esbuild entry.js --bundle --minify --format=iife --global-name=TT \
  --banner:js="/* TipTap ${VERS} (MIT) · ProseMirror (MIT) — empaquetado para dnd-tracker. Fuente: tools/tiptap */" \
  --outfile=../../js/vendor/tiptap.min.js
echo "OK → js/vendor/tiptap.min.js (TipTap ${VERS})"
