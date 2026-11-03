// Tema Pergamino: contraste sobre papel (con el tono más oscuro del grano), adornos
// que no tapan ni interceptan, grabados según el arma, medallón de Grum, anchos
// 375/480/560 sin scroll horizontal y recursos disponibles sin conexión.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const AUDITAR = require('./contraste');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PEOR_PAPEL = '#C4A47C'; // fondo miel con grano y viñeta en su punto más oscuro

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  const fallidos = [];
  p.on('requestfailed', r => fallidos.push(r.url()));
  p.on('response', r => { if (r.status() >= 400) fallidos.push(r.status() + ' ' + r.url()); });
  await p.setViewport({ width: 1440, height: 900 });
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };

  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1'); localStorage.setItem('dnd_theme_v1', 'light'); localStorage.removeItem('dnd_theme');
    const t = Characters.createNew('Torvald Ironhollow', 'Explorador'); t.id = 'tv'; t.nivel = 3; t.subclase = 'Beast Master';
    t.companion = { beast: 'land', name: 'Grum' };
    const arma = (id, name, type, die) => ({ id, name, kind: 'weapon', die, type, bonuses: { ac: 0, attack: 0, damage: 0, save: 0 }, buffs: [] });
    t.equipment = { ...(t.equipment || {}), mainHand: arma('longbow', 'Longbow', 'ranged', '1d8'), offHand: arma('shortsword', 'Shortsword', 'melee', '1d6') };
    Storage.saveChar(t); Storage.saveChar(Characters.buildLursey());
    // Ficha sin arma ni compañero ni retrato
    const v = Characters.createNew('Vacío', 'Mago'); v.id = 'vacio'; Storage.saveChar(v);
  });
  await p.reload({ waitUntil: 'networkidle2' }); await p.evaluate(() => skipLogin()); await sleep(400);
  chk('preferencia clara vieja abre en Pergamino', await p.evaluate(() => document.documentElement.dataset.theme === 'light' && document.querySelector('[data-tema-nombre]').textContent === 'Pergamino'));
  let a = await p.evaluate(AUDITAR, PEOR_PAPEL);
  chk('inicio legible sobre papel', a.malos.length === 0, a.malos.slice(0, 8));

  const ficha = async (id, w = 1440) => {
    await p.setViewport({ width: w, height: 900 });
    await p.evaluate(id => { Storage.setActiveId(id); sessionStorage.setItem('dnd_playing', '1'); }, id);
    await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1800);
  };
  const tabs = ['combate', 'habilidades', 'conjuros', 'equipo', 'bastion', 'biblioteca'];
  const auditar = async quien => {
    const malos = [];
    for (const tab of tabs) {
      const ok = await p.evaluate(tab => { const b = document.querySelector(`[data-tab="${tab}"]`); if (!b || b.style.display === 'none') return false; App.switchTab(tab); return true; }, tab);
      if (!ok) continue;
      await sleep(350);
      for (const pos of [0, 0.5, 1]) { // arriba, medio y final de cada panel con scroll
        await p.evaluate(pos => document.querySelectorAll('.tab-panel.active, .tab-panel.active *, .stats-sidebar').forEach(e => {
          if (e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)) e.scrollTop = (e.scrollHeight - e.clientHeight) * pos; }), pos);
        await sleep(120);
        (await p.evaluate(AUDITAR, PEOR_PAPEL)).malos.forEach(m => malos.push({ tab, ...m }));
      }
    }
    const unicos = [...new Map(malos.map(m => [m.k, m])).values()];
    console.log(`    ${quien}: ${unicos.length} combinaciones bajo contraste`);
    return unicos;
  };

  await ficha('lursey-brumaclara');
  const grabL = await p.evaluate(() => [...document.querySelectorAll('.arma-ic')].map(e => e.dataset.grabado));
  chk('Lursey: maza grabada', grabL.join() === 'maza', grabL);
  const deco = await p.evaluate(() => ({
    antes: getComputedStyle(document.body, '::before').pointerEvents, despues: getComputedStyle(document.body, '::after').pointerEvents,
    clase: document.documentElement.dataset.clase,
    hdrBg: getComputedStyle(document.getElementById('appHeader')).backgroundImage,
  }));
  chk('adornos sin interceptar toques; Lursey con estandarte y sin motivos de Torvald', deco.antes === 'none' && deco.despues === 'none' && /estandarte/.test(deco.hdrBg) && !/montanas|huella/.test(deco.hdrBg), deco);
  // El espacio de los motivos queda libre: nada de la cabecera llega a esa franja
  const libre = await p.evaluate(() => { const h = document.getElementById('appHeader'); const hr = h.getBoundingClientRect();
    const max = Math.max(...[...h.querySelectorAll('*')].filter(e => e.getBoundingClientRect().width).map(e => e.getBoundingClientRect().right));
    return { contenidoHasta: Math.round(max), ancho: Math.round(hr.width) }; });
  chk('la cabecera deja libre la franja de los motivos (≥ 340px)', libre.ancho - libre.contenidoHasta >= 340, libre);
  const malL = await auditar('Lursey');
  chk('Lursey legible en todas las pestañas (incluye Bastión)', malL.length === 0, malL.slice(0, 12));

  // Estados: vida crítica, panel de combate, aviso, diálogo
  await p.evaluate(() => { const c = Storage.getChar('lursey-brumaclara'); c.hp.current = 6; App.reloadChar(c); App.switchTab('combate'); App.botonCombate(); });
  await sleep(500);
  const est = [];
  (await p.evaluate(AUDITAR, PEOR_PAPEL)).malos.forEach(m => est.push({ estado: 'combate', ...m }));
  await p.evaluate(() => App.showToast('Aviso de prueba', 'error')); await sleep(250);
  (await p.evaluate(AUDITAR, PEOR_PAPEL)).malos.forEach(m => est.push({ estado: 'aviso', ...m }));
  await p.evaluate(() => { App.resetCombat?.(); App.openShortRest(); }); await sleep(400);
  (await p.evaluate(AUDITAR, PEOR_PAPEL)).malos.forEach(m => est.push({ estado: 'diálogo', ...m }));
  const vida = await p.evaluate(() => getComputedStyle(document.getElementById('hdrHP')).color);
  chk('vida crítica, combate, aviso y diálogo legibles', est.length === 0 && vida === 'rgb(140, 36, 39)', { vida, est: est.slice(0, 10) });
  await p.evaluate(() => { const c = Storage.getChar('lursey-brumaclara'); c.hp.current = c.hp.max; App.reloadChar(c); });

  await ficha('tv');
  const t = await p.evaluate(() => ({ armas: [...document.querySelectorAll('.arma-ic')].map(e => e.dataset.grabado),
    bestia: document.querySelector('.companion-emoji')?.dataset.bestia, hdrBg: getComputedStyle(document.getElementById('appHeader')).backgroundImage,
    medallon: getComputedStyle(document.querySelector('.companion-emoji')).backgroundImage }));
  chk('Torvald: arco y espada grabados, medallón de tierra, montañas y huella', t.armas.join() === 'arco,espada' && t.bestia === 'land' && /medallon-tierra/.test(t.medallon) && /montanas/.test(t.hdrBg) && /huella/.test(t.hdrBg), t);
  const malT = await auditar('Torvald');
  chk('Torvald legible en todas las pestañas', malT.length === 0, malT.slice(0, 12));

  await ficha('vacio');
  const v = await p.evaluate(() => ({ armas: document.querySelectorAll('.arma-ic').length, comp: document.querySelectorAll('.companion-emoji').length, hdr: getComputedStyle(document.getElementById('appHeader')).backgroundImage }));
  chk('ficha sin arma ni compañero: sin huecos, solo estandarte', v.armas === 0 && v.comp === 0 && /estandarte/.test(v.hdr) && !/montanas/.test(v.hdr), v);

  // Anchos angostos: sin scroll horizontal, borde reducido, sin motivos en la cabecera
  for (const w of [560, 480, 375]) {
    for (const id of ['lursey-brumaclara', 'tv']) {
      await ficha(id, w);
      for (const tab of tabs) {
        await p.evaluate(tab => { const b = document.querySelector(`[data-tab="${tab}"]`); if (b && b.style.display !== 'none') App.switchTab(tab); }, tab); await sleep(150);
        const r = await p.evaluate(() => ({ ancho: document.documentElement.scrollWidth, borde: getComputedStyle(document.body, '::before').borderTopWidth,
          motivos: /estandarte|montanas/.test(getComputedStyle(document.getElementById('appHeader')).backgroundImage) }));
        if (r.ancho > w || r.borde !== '2px' || r.motivos) { chk(`${id} ${tab} a ${w}px`, false, r); }
      }
    }
  }
  chk('375/480/560: sin scroll horizontal, borde fino y sin motivos en cabecera', true);
  chk('todos los recursos cargan', fallidos.filter(u => /pergamino|tema/.test(u)).length === 0, fallidos.slice(0, 5));

  // Cambiar a Clásico y volver conserva la pestaña
  await ficha('tv');
  await p.evaluate(() => App.switchTab('conjuros')); await sleep(200);
  await p.evaluate(() => { Tema.aplicar('dark', true); Tema.aplicar('light', true); }); await sleep(200);
  chk('Pergamino ↔ Clásico conserva la pestaña', await p.evaluate(() => document.querySelector('.tab-btn.active')?.dataset.tab) === 'conjuros');

  // Sin conexión, tras instalar la versión nueva del SW
  await p.evaluate(() => navigator.serviceWorker.ready); await sleep(2500);
  const cache = await p.evaluate(async () => {
    const k = (await caches.keys()).find(k => k.startsWith('dnd-tracker-v')); const c = await caches.open(k);
    const faltan = []; for (const r of performance.getEntriesByType('resource')) if (/pergamino/.test(r.name) && !(await c.match(r.name.replace(/\?.*/, '')))) faltan.push(r.name);
    return { k, faltan };
  });
  await p.setOfflineMode(true);
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500);
  const off = await p.evaluate(() => ({ t: document.documentElement.dataset.theme, papel: getComputedStyle(document.body).backgroundImage.includes('papel'),
    img: performance.getEntriesByType('resource').filter(r => /pergamino\/.*svg/.test(r.name)).length }));
  chk('sin conexión: Pergamino y sus recursos desde el caché', cache.faltan.length === 0 && off.t === 'light' && off.papel, { cache, off });

  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
