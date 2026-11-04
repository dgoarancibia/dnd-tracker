/* ═══════════════════════════════════════════════════════════
   iconos.js — Íconos grabados (game-icons.net, CC BY 3.0) junto a los emoji
   de pestañas, títulos, características, condiciones y dados de golpe.
   No borra nada: el emoji queda en <span class="emo-orig"> y el ícono en
   <i class="ico">. Cada tema decide qué se ve (por defecto, el emoji;
   Ónix muestra el ícono). Así cambiar de tema no exige volver a pintar.
   ═══════════════════════════════════════════════════════════ */
(() => {
  // La url va en una variable CSS: se resuelve contra la hoja que la usa (css/tema.css)
  const BASE = '../assets/iconos/';
  const EMO = /^[\s\p{Extended_Pictographic}️‍✦✨⚡🗡⚔⬡]+/u;
  const TAB = { combate: 'combate', equipo: 'items', habilidades: 'habilidades', conjuros: 'conjuros', bastion: 'bastion', biblioteca: 'biblioteca' };
  const TITULO = [[/estad[ií]sticas/i, 'estadisticas'], [/^skills/i, 'skills'], [/recursos/i, 'recursos'], [/ataques|maniobras/i, 'ataques'],
    [/conjuros|dominio|preparados/i, 'conjuros'], [/[ií]tems/i, 'items'], [/companion|compa[ñn]ero/i, 'companero'], [/condiciones/i, 'condiciones'],
    [/iniciativa/i, 'combate'], [/habilidades|rasgos|feats/i, 'habilidades'], [/prioridad/i, 'recursos'], [/pouch/i, 'd20'], [/basti[oó]n/i, 'bastion']];
  const STAT = { FUE: 'fue', DES: 'des', CON: 'con', INT: 'int', SAB: 'sab', CAR: 'car' };
  const COND = { 'Caído': 'cond-derribado', 'Envenenado': 'cond-envenenado', 'Aturdido': 'cond-aturdido', 'Agarrado': 'cond-agarrado',
    'Asustado': 'cond-asustado', 'Incapacitado': 'cond-incapacitado', 'Cegado': 'cond-cegado', 'Encantado': 'cond-hechizado',
    'Ensordecido': 'cond-ensordecido', 'Invisible': 'cond-invisible', 'Paralizado': 'cond-paralizado', 'Apresado': 'cond-apresado' };

  const ico = nombre => {
    const i = document.createElement('i');
    i.className = 'ico';
    i.setAttribute('aria-hidden', 'true');
    i.style.setProperty('--m', `url(${BASE}${nombre}.svg)`);
    return i;
  };

  // Envuelve el emoji del comienzo en .emo-orig y devuelve dónde poner el ícono.
  // Pergamino ya pudo haberlo envuelto en .emo (js/tema.js): se respeta.
  function separarEmoji(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.data.trim() || n.parentElement.closest('button, .emo-orig')) continue;
      const emo = n.parentElement.closest('.emo');
      if (emo) { const s = document.createElement('span'); s.className = 'emo-orig'; emo.replaceWith(s); s.append(emo); return { antes: s, texto: null }; }
      const m = n.data.match(EMO);
      if (m && m[0].trim()) {
        const s = document.createElement('span'); s.className = 'emo-orig'; s.textContent = m[0];
        n.data = n.data.slice(m[0].length);
        n.parentNode.insertBefore(s, n);
        return { antes: s, texto: n };
      }
      return { antes: n, texto: n };
    }
    return null;
  }

  function decorar() {
    document.querySelectorAll('.tab-btn[data-tab] .tab-ic:not([data-ico])').forEach(s => {
      s.dataset.ico = '1';
      const e = document.createElement('span'); e.className = 'emo-orig';
      while (s.firstChild) e.append(s.firstChild);
      s.append(e, ico(TAB[s.parentElement.dataset.tab] || 'd20'));
    });
    document.querySelectorAll('.section-hd:not([data-ico])').forEach(h => {
      h.dataset.ico = '1';
      const texto = (h.textContent || '').replace(EMO, '').trim();
      const par = TITULO.find(([re]) => re.test(texto));
      if (!par) return;
      const pos = separarEmoji(h);
      if (!pos) return;
      // En títulos flex (texto + botón) ícono y texto van en un solo bloque
      let ancla = pos.antes;
      if (ancla.parentNode === h) { const b = document.createElement('span'); h.insertBefore(b, ancla); b.append(ancla); if (pos.texto && pos.texto.parentNode === h) b.append(pos.texto); }
      ancla.parentNode.insertBefore(ico(par[1]), ancla);
    });
    document.querySelectorAll('.stat-block-name:not([data-ico])').forEach(s => {
      s.dataset.ico = '1'; const k = STAT[s.textContent.trim()]; if (k) s.prepend(ico(k));
    });
    document.querySelectorAll('.cond-btn:not([data-ico])').forEach(b => {
      b.dataset.ico = '1'; const k = COND[b.textContent.trim()]; if (k) b.prepend(ico(k));
    });
    document.querySelectorAll('.rc-name:not([data-ico])').forEach(r => {
      r.dataset.ico = '1'; const m = r.textContent.match(/dados de golpe \(d(\d+)\)/i); if (m) r.prepend(ico('d' + m[1]));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    decorar();
    let pendiente = false;
    new MutationObserver(() => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => { pendiente = false; decorar(); });
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
