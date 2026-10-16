#!/usr/bin/env node
/* check_sw.js — Verifica que cada archivo que el service worker precarga
   exista en disco. Si falta uno solo, cache.addAll() falla entero y el SW
   nunca se instala: la app pierde el modo offline y las actualizaciones.
   Uso: node tools/check_sw.js  (sale con código 1 si falta algo) */
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
const bloque = (sw.match(/cache\.addAll\(\[([\s\S]*?)\]\)/) || [])[1] || '';
const rutas = [...bloque.matchAll(/'(\.\/[^']+)'/g)].map(m => m[1]);
const faltan = rutas.filter(r => !fs.existsSync(path.join(raiz, r)));
if (!rutas.length) { console.error('✗ No se encontró la lista de precache en sw.js'); process.exit(1); }
if (faltan.length) {
  console.error('✗ El service worker precarga archivos que no existen:');
  faltan.forEach(f => console.error('   • ' + f));
  process.exit(1);
}
console.log(`✅ Precache del SW: ${rutas.length} archivos, todos existen.`);

/* firebase.js debe importarse con la MISMA ?v= desde app.html y cloud.js:
   con versiones distintas el módulo se evalúa dos veces. */
const appHtml = fs.readFileSync(path.join(raiz, 'app.html'), 'utf8');
const cloudJs = fs.readFileSync(path.join(raiz, 'js/cloud.js'), 'utf8');
const vApp = (appHtml.match(/import\('\.\/js\/firebase\.js\?v=(\d+)'\)/) || [])[1];
const vCloud = (cloudJs.match(/import '\.\/firebase\.js\?v=(\d+)'/) || [])[1];
if (vApp !== vCloud) {
  console.error(`✗ firebase.js con versiones distintas: app.html ?v=${vApp} / cloud.js ?v=${vCloud}`);
  process.exit(1);
}
console.log(`✅ firebase.js con la misma versión en app.html y cloud.js (?v=${vApp}).`);
