// Contraste WCAG de cada texto visible contra su fondo efectivo (mezclando alfas).
// peorFondo: color a usar como fondo del body cuando tiene textura (el tono más oscuro del grano/viñeta).
module.exports = (peorFondo) => {
  const rgba = s => { if (/^#/.test(s)) { const h = s.slice(1); return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)).concat(1); } const m = s.match(/[\d.]+/g) || [0,0,0,0]; return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]]; };
  const lum = ([r,g,b]) => { const f = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };
  const mezcla = (a, b) => [0,1,2].map(i => a[i]*a[3] + b[i]*(1-a[3])).concat(1);
  const fondo = el => {
    const capas = [];
    for (let e = el; e; e = e.parentElement) {
      if (e === document.body && peorFondo) break;
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none' && /gradient/.test(cs.backgroundImage)) {
        const m = cs.backgroundImage.match(/rgba?\([^)]+\)/); if (m) { capas.push(rgba(m[0])); if (rgba(m[0])[3] >= 1) break; }
      }
      const c = rgba(cs.backgroundColor); if (c[3] > 0) { capas.push(c); if (c[3] >= 1) break; }
    }
    let r = rgba(peorFondo || getComputedStyle(document.body).backgroundColor);
    for (let i = capas.length - 1; i >= 0; i--) r = mezcla(capas[i], r);
    return r;
  };
  const malos = new Map(); let total = 0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode; if (!n.textContent.trim()) continue;
    const el = n.parentElement; const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0 || el.closest('[hidden],[aria-hidden="true"]')) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    if (op < 0.5) continue; // atenuado a propósito (deshabilitado / usado)
    const bg = fondo(el); const fg = mezcla(rgba(cs.color), bg);
    const a = lum(fg), b = lum(bg); const cr = (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
    const px = parseFloat(cs.fontSize), grande = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    total++;
    // Un símbolo suelto (★ ● ✓ ✕…) es un ícono de control: WCAG 1.4.11 pide 3:1, no 4.5:1
    const icono = /^[★☆●○◆◇✦✓✕×▸▾+−]$/.test(n.textContent.trim());
    if (cr < (grande || icono ? 3 : 4.5)) {
      const k = (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName) + ` ${cs.color}/${cs.backgroundColor}`;
      if (!malos.has(k)) malos.set(k, { k, cr: +cr.toFixed(2), txt: n.textContent.trim().slice(0, 30) });
    }
  }
  return { total, malos: [...malos.values()].sort((x, y) => x.cr - y.cr) };
};
