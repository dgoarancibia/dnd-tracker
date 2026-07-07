#!/bin/bash
# bump.sh — sube la versión del SW en todos los archivos necesarios
# Uso: ./bump.sh [nueva_version]
# Si no se pasa versión, detecta la actual y suma 1.

set -e

# Detectar versión actual desde sw.js
CURRENT=$(grep -o 'dnd-tracker-v[0-9]*' sw.js | grep -o '[0-9]*')
NEW=${1:-$((CURRENT + 1))}

if [ "$CURRENT" = "$NEW" ]; then
  echo "⚠ La versión ya es $CURRENT, nada que cambiar."
  exit 0
fi

echo "📦 Bumping v$CURRENT → v$NEW"

# sw.js (3 ocurrencias)
sed -i '' "s/dnd-tracker-v${CURRENT}/dnd-tracker-v${NEW}/g" sw.js
sed -i '' "s/version: ${CURRENT}/version: ${NEW}/g" sw.js

# app.html (solo _SW_EXPECTED — _V fue eliminado)
sed -i '' "s/const _SW_EXPECTED = ${CURRENT}/const _SW_EXPECTED = ${NEW}/" app.html

# index.html (2 ocurrencias: _V y _SW_EXPECTED_IDX)
sed -i '' "s/var _V=${CURRENT}/var _V=${NEW}/" index.html
sed -i '' "s/_SW_EXPECTED_IDX = ${CURRENT}/_SW_EXPECTED_IDX = ${NEW}/" index.html

# manifest.json (1 ocurrencia en start_url)
sed -i '' "s/v=${CURRENT}/v=${NEW}/g" manifest.json

# Verificar que no quedaron ocurrencias viejas
REMAINING=$(grep -r "v${CURRENT}\b" sw.js app.html index.html manifest.json 2>/dev/null | grep -v "Binary" | wc -l | tr -d ' ')
if [ "$REMAINING" -gt "0" ]; then
  echo "⚠ Quedaron $REMAINING ocurrencias de v$CURRENT sin actualizar:"
  grep -rn "v${CURRENT}\b" sw.js app.html index.html manifest.json 2>/dev/null || true
fi

echo "✅ Versión bumpeada a v$NEW en sw.js, app.html, index.html, manifest.json"
echo "   Recordá también subir los ?v= de app.js, style.css, characters.js si cambiaron."
