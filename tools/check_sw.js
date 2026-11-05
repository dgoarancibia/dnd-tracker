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
const indexHtml = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const vIndex = (indexHtml.match(/src="js\/firebase\.js\?v=(\d+)"/) || [])[1];
if (vIndex && vIndex !== vApp) {
  console.error(`✗ firebase.js con versiones distintas: index.html ?v=${vIndex} / app.html ?v=${vApp}`);
  process.exit(1);
}
if (vApp !== vCloud) {
  console.error(`✗ firebase.js con versiones distintas: app.html ?v=${vApp} / cloud.js ?v=${vCloud}`);
  process.exit(1);
}
console.log(`✅ firebase.js con la misma versión en app.html y cloud.js (?v=${vApp}).`);

/* Las lecturas que deciden la lista (qué bajar, subir o mandar a la papelera)
   deben ir al servidor: getDocs podía devolver solo lo que Firestore tenía en
   memoria y mandar personajes a la papelera (iPad, nov-2026). */
const fbJs = fs.readFileSync(path.join(raiz, 'js/firebase.js'), 'utf8');
const leeServidor = nombre => new RegExp(`async function ${nombre}\\([^)]*\\) \\{\\s*const snap = await get(Docs?)FromServer\\(`).test(fbJs);
const sinServidor = ['loadAllCharsCloud', 'loadDeletedCloud', 'loadCharCloud'].filter(n => !leeServidor(n));
if (sinServidor.length) {
  console.error(`✗ Deben leer del servidor (getDocsFromServer/getDocFromServer): ${sinServidor.join(', ')}`);
  process.exit(1);
}
console.log('✅ La lista de la nube se lee del servidor, no de la memoria de Firestore.');
