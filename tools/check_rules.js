#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   check_rules.js — Verificador de datos de reglas D&D 2024.

   Carga js/characters.js en un sandbox (sin DOM) y comprueba
   invariantes que NO dependen de conocer el PHB de memoria:
   cosas que si fallan son un error seguro.

   Uso:  node tools/check_rules.js
   Sale con código 1 si hay errores (sirve para pre-push).
   ═══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(RAIZ, 'js/characters.js'), 'utf8');
const ctx = { console, window: {}, document: {} };
vm.createContext(ctx);
vm.runInContext(src + '\n;globalThis.__C = Characters;', ctx);
const C = ctx.__C;

const STATS = { fue: 15, des: 15, con: 14, int: 12, sab: 14, car: 12 };
const errores = [];
const avisos = [];
const err = (m) => errores.push(m);
const avisar = (m) => avisos.push(m);

const clases = Object.keys(C.CLASES_CONFIG);
const charDe = (cl, n) => ({
  clase: cl, nivel: n, stats: STATS,
  spellcastingStat: C.CLASES_CONFIG[cl].spellcastingStat,
});

// Primera aparición de cada feature, por clase.
function featuresPorNivel(cl) {
  const f = C.CLASE_FEATURES[cl];
  if (!f || typeof f.features !== 'function') return null;
  const primera = new Map();
  for (let n = 1; n <= 20; n++) {
    let arr = [];
    try { arr = f.features(n, charDe(cl, n)) || []; }
    catch (e) { err(`${cl} nv${n}: features() lanzó "${e.message}"`); continue; }
    for (const x of arr) if (!primera.has(x.id)) primera.set(x.id, { n, ...x });
  }
  return primera;
}

/* ── 1. Ninguna feature puede desaparecer al subir de nivel ────── */
for (const cl of clases) {
  const f = C.CLASE_FEATURES[cl];
  if (!f || typeof f.features !== 'function') continue;
  const vistos = new Map();
  for (let n = 1; n <= 20; n++) {
    let arr = [];
    try { arr = f.features(n, charDe(cl, n)) || []; } catch (e) { continue; }
    const ids = new Set(arr.map((x) => x.id));
    for (const [id, desde] of [...vistos]) {
      if (!ids.has(id)) {
        err(`${cl}: la feature "${id}" aparece en nv${desde} pero ya no está en nv${n}`);
        vistos.delete(id);
      }
    }
    for (const id of ids) if (!vistos.has(id)) vistos.set(id, n);
  }
}

/* ── 2. El texto "Nivel N" del source debe coincidir con el nivel real ── */
for (const cl of clases) {
  const primera = featuresPorNivel(cl);
  if (!primera) continue;
  for (const [, v] of primera) {
    const m = (v.source || '').match(/Nivel\s+(\d+)/i);
    if (m && +m[1] !== v.n) {
      err(`${cl}: "${v.name}" dice «Nivel ${m[1]}» en source pero aparece en nv${v.n}`);
    }
  }
}

/* ── 3. Un caster nunca puede tener 0 slots en su primer nivel ──── */
for (const cl of clases) {
  const cfg = C.CLASES_CONFIG[cl];
  if (!cfg.slotTable) continue;
  for (let n = 1; n <= 20; n++) {
    const slots = C.getSlotsForClass(cl, n) || [];
    const total = slots.reduce((a, b) => a + b, 0);
    if (total === 0) {
      // Solo es error si la clase ya lanza a ese nivel (tiene preparados > 0).
      const prep = C.getPreparedMaxAtLevel(charDe(cl, n), n);
      if (prep > 0) err(`${cl} nv${n}: puede preparar ${prep} conjuros pero tiene 0 slots`);
    }
  }
}

/* ── 4. Los slots nunca deben bajar al subir de nivel ──────────── */
for (const cl of clases) {
  if (!C.CLASES_CONFIG[cl].slotTable) continue;
  let prev = 0;
  for (let n = 1; n <= 20; n++) {
    const tot = (C.getSlotsForClass(cl, n) || []).reduce((a, b) => a + b, 0);
    if (tot < prev) err(`${cl}: los slots bajan de ${prev} (nv${n - 1}) a ${tot} (nv${n})`);
    prev = tot;
  }
}

/* ── 5. Los conjuros preparados nunca deben bajar ──────────────── */
for (const cl of clases) {
  if (!C.CLASES_CONFIG[cl].slotTable) continue;
  let prev = 0;
  for (let n = 1; n <= 20; n++) {
    const p = C.getPreparedMaxAtLevel(charDe(cl, n), n);
    if (p < prev) err(`${cl}: los preparados bajan de ${prev} (nv${n - 1}) a ${p} (nv${n})`);
    prev = p;
  }
}

/* ── 6. Nunca preparar conjuros de nivel superior al máximo accesible ── */
for (const cl of clases) {
  if (!C.CLASES_CONFIG[cl].slotTable) continue;
  for (let n = 1; n <= 20; n++) {
    const slots = C.getSlotsForClass(cl, n) || [];
    const maxSlot = slots.reduce((mx, v, i) => (v > 0 ? i + 1 : mx), 0);
    const maxSpell = C.getMaxSpellLevel(charDe(cl, n), n);
    if (maxSpell > maxSlot && maxSlot > 0) {
      err(`${cl} nv${n}: permite conjuros de nivel ${maxSpell} pero su slot más alto es ${maxSlot}`);
    }
  }
}

/* ── 7. Todo conjuro del catálogo debe tener nivel y nombre válidos ── */
for (const cl of Object.keys(C.CLASE_SPELLS)) {
  const lista = C.CLASE_SPELLS[cl] || [];
  const vistos = new Map();
  for (const sp of lista) {
    if (!sp.name) { err(`${cl}: conjuro sin nombre (id=${sp.id})`); continue; }
    if (sp.level == null || sp.level < 0 || sp.level > 9) {
      err(`${cl}: "${sp.name}" tiene nivel inválido (${sp.level})`);
    }
    const clave = sp.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    if (vistos.has(clave)) err(`${cl}: "${sp.name}" está duplicado en el catálogo`);
    else vistos.set(clave, sp);
  }
}

/* ── 8. Toda elección pendiente debe poder resolverse ───────────── */
for (const cl of clases) {
  for (let n = 2; n <= 20; n++) {
    let pend = [];
    try { pend = C.getPendingChoices(charDe(cl, n), n, n - 1) || []; }
    catch (e) { err(`${cl} nv${n}: getPendingChoices lanzó "${e.message}"`); continue; }
    for (const p of pend) {
      if (!p.id) err(`${cl} nv${n}: elección sin id`);
      const tieneOpciones = Array.isArray(p.options) ? p.options.length > 0 : true;
      if (!tieneOpciones) err(`${cl} nv${n}: la elección "${p.id}" no ofrece ninguna opción`);
    }
  }
}

/* ── 9. AVISO: niveles sin ninguna feature nueva ────────────────
   En 2024 casi ningún nivel queda vacío. No es error seguro
   (puede ser un nivel de solo-subclase), pero vale revisarlo.   */
for (const cl of clases) {
  const primera = featuresPorNivel(cl);
  if (!primera) { avisar(`${cl}: no tiene features() definidas`); continue; }
  const conAlgo = new Set([...primera.values()].map((v) => v.n));
  const vacios = [];
  for (let n = 1; n <= 20; n++) if (!conAlgo.has(n)) vacios.push(n);
  if (vacios.length) avisar(`${cl}: ${vacios.length} niveles sin feature nueva → ${vacios.join(', ')}`);
}

/* ── 10. AVISO: términos de 2014 que ya no existen en 2024 ─────── */
const OBSOLETOS_2014 = [
  'song of rest', 'primeval awareness', 'hide in plain sight',
  "land's stride", 'vanish', 'spells known', 'dark one’s own luck',
  'sneak attack (2014)', 'ki points', 'favored terrain',
];
for (const cl of clases) {
  const primera = featuresPorNivel(cl);
  if (!primera) continue;
  for (const [, v] of primera) {
    const txt = `${v.name || ''} ${v.desc || ''}`.toLowerCase();
    for (const t of OBSOLETOS_2014) {
      if (txt.includes(t)) avisar(`${cl}: "${v.name}" (nv${v.n}) menciona «${t}», término de 2014`);
    }
  }
}

/* ── Reporte ───────────────────────────────────────────────────── */
console.log(`\n🎲 check_rules — ${clases.length} clases verificadas\n`);
if (errores.length) {
  console.log(`❌ ${errores.length} ERROR(ES):`);
  errores.forEach((e) => console.log('   • ' + e));
} else {
  console.log('✅ Sin errores seguros.');
}
if (avisos.length) {
  console.log(`\n⚠️  ${avisos.length} aviso(s) para revisar a mano:`);
  avisos.forEach((a) => console.log('   • ' + a));
}
console.log('');
process.exit(errores.length ? 1 : 0);
