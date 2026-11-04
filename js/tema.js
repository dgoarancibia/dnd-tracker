/* ═══════════════════════════════════════════════════════════
   tema.js — Apariencia compartida por index.html y app.html
   Se carga sincrónico en <head> para aplicar el tema antes de pintar.
   Valores: 'dark' (Clásico), 'slate-brass' (Pizarra y latón), 'light' (Pergamino),
   'onix' (Ónix y granate).
   ═══════════════════════════════════════════════════════════ */
const Tema = (() => {
  // Antes cada página guardaba el tema en su propia clave; se leen las dos
  // (gana la de la ficha) y desde ahora se escriben ambas.
  const CLAVES = ['dnd_theme', 'dnd_theme_v1'];
  const OPCIONES = [
    { id: 'dark',        nombre: 'Clásico',         muestra: ['#0e0d09', '#c9973a'] },
    { id: 'slate-brass', nombre: 'Pizarra y latón', muestra: ['#11171F', '#D9AE65'] },
    { id: 'light',       nombre: 'Pergamino',       muestra: ['#D5B68E', '#702D31'] },
    { id: 'onix',        nombre: 'Ónix y granate',  muestra: ['#120F10', '#A82835'] },
  ];
  const valido = id => OPCIONES.some(o => o.id === id);

  function actual() {
    for (const k of CLAVES) {
      let v = null;
      try { v = localStorage.getItem(k); } catch (e) {}
      if (v) return valido(v) ? v : 'dark';
    }
    return 'dark';
  }

  function aplicar(id, guardar) {
    if (!valido(id)) id = 'dark';
    document.documentElement.setAttribute('data-theme', id);
    if (guardar) CLAVES.forEach(k => { try { localStorage.setItem(k, id); } catch (e) {} });
    _sincronizar(id);
    if (id === 'light' && document.body) _entintar(document.body);
    return id;
  }

  /* Pergamino: los emoji a todo color rompen el papel. Cada emoji va en un
     <span class="emo"> que pergamino.css tiñe de tinta. El texto del nodo
     queda dentro de un <span class="emo-t"> para no cambiar espacios en
     botones flex. El texto visible (textContent) no cambia. */
  const EMO = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\uFE0F?/gu;
  const SALTAR = '.emo, .ProseMirror, [contenteditable], .arma-ic, .companion-emoji, script, style, textarea, select';
  function _entintar(raiz) {
    const nodos = [];
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      EMO.lastIndex = 0;
      if (EMO.test(n.data) && !n.parentElement.closest(SALTAR)) nodos.push(n);
    }
    nodos.forEach(n => {
      const t = document.createElement('span');
      t.className = 'emo-t';
      let i = 0;
      n.data.replace(EMO, (m, pos) => {
        if (pos > i) t.append(n.data.slice(i, pos));
        const e = document.createElement('span');
        e.className = 'emo';
        e.textContent = m;
        t.append(e);
        i = pos + m.length;
      });
      if (i < n.data.length) t.append(n.data.slice(i));
      n.replaceWith(t);
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (actual() === 'light') _entintar(document.body);
    new MutationObserver(ms => {
      if (document.documentElement.dataset.theme !== 'light') return;
      ms.forEach(m => m.addedNodes.forEach(n => {
        const raiz = n.nodeType === 3 ? n.parentElement : n;
        if (raiz && raiz.nodeType === 1) _entintar(raiz);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  });

  // Marca la opción activa en todos los selectores montados de la página.
  function _sincronizar(id) {
    document.querySelectorAll('[data-tema-selector]').forEach(g => {
      g.querySelectorAll('[data-tema]').forEach(b => {
        const on = b.dataset.tema === id;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
    });
    const nombre = OPCIONES.find(o => o.id === id).nombre;
    document.querySelectorAll('[data-tema-nombre]').forEach(s => { s.textContent = nombre; });
  }

  // Grupo de radio accesible: flechas para moverse, Enter/Espacio o toque para elegir.
  function montar(el) {
    if (!el) return;
    el.setAttribute('data-tema-selector', '');
    el.setAttribute('role', 'radiogroup');
    el.setAttribute('aria-label', 'Apariencia');
    el.innerHTML = OPCIONES.map(o =>
      `<button type="button" role="radio" class="tema-opt" data-tema="${o.id}">` +
        `<span class="tema-sw" aria-hidden="true" style="background:linear-gradient(135deg,${o.muestra[0]} 50%,${o.muestra[1]} 50%)"></span>` +
        `<span class="tema-nm">${o.nombre}</span>` +
      `</button>`).join('');
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-tema]');
      if (b) aplicar(b.dataset.tema, true);
    });
    el.addEventListener('keydown', e => {
      const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!paso) return;
      e.preventDefault();
      const i = OPCIONES.findIndex(o => o.id === actual());
      const sig = OPCIONES[(i + paso + OPCIONES.length) % OPCIONES.length].id;
      aplicar(sig, true);
      el.querySelector(`[data-tema="${sig}"]`)?.focus();
    });
    _sincronizar(actual());
  }

  aplicar(actual(), false);
  return { OPCIONES, actual, aplicar, montar };
})();
