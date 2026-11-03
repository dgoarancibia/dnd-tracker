// Selector de Apariencia: Clásico / Pizarra y latón / Pergamino.
// Preferencias viejas, persistencia entre pantallas, cambio en vivo sin perder
// pestaña ni scroll, teclado, contraste en Pizarra y capturas de Combate.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE, salida } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const AUDITAR = require('./contraste');

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  // Tema presente en el primer DOMContentLoaded = sin destello al navegar.
  await p.evaluateOnNewDocument(() => {
    document.addEventListener('DOMContentLoaded', () => { window.__temaInicial = document.documentElement.dataset.theme; });
  });
  await p.setViewport({ width: 1440, height: 900 });
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };
  const tema = () => p.evaluate(() => ({ t: document.documentElement.dataset.theme, ini: window.__temaInicial,
    nombre: document.querySelector('[data-tema-nombre]')?.textContent, activo: document.querySelector('[aria-checked="true"]')?.dataset.tema }));
  const idx = async (prefs) => {
    await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
    await p.evaluate(prefs => { localStorage.removeItem('dnd_theme'); localStorage.removeItem('dnd_theme_v1');
      Object.entries(prefs).forEach(([k, v]) => localStorage.setItem(k, v)); localStorage.setItem('dnd_guest', '1'); }, prefs);
    await p.reload({ waitUntil: 'networkidle2' }); await sleep(800);
    await p.evaluate(() => skipLogin()); await sleep(300);
    return tema();
  };

  // Preferencias de antes y valores raros
  let t = await idx({});
  chk('sin preferencia abre en Clásico', t.ini === 'dark' && t.nombre === 'Clásico', t);
  t = await idx({ dnd_theme_v1: 'light' });
  chk('claro guardado en el inicio → Pergamino', t.ini === 'light' && t.nombre === 'Pergamino', t);
  t = await idx({ dnd_theme: 'light' });
  chk('claro guardado en la ficha → Pergamino', t.ini === 'light', t);
  t = await idx({ dnd_theme: 'dark', dnd_theme_v1: 'light' });
  chk('si difieren gana la ficha', t.t === 'dark', t);
  t = await idx({ dnd_theme: 'morado' });
  chk('valor inválido → Clásico', t.t === 'dark' && t.nombre === 'Clásico', t);

  // Elegir en el inicio con el popover
  await p.evaluate(() => {
    const t = Characters.createNew('Torvald Ironhollow', 'Explorador'); t.id = 'tv'; t.nivel = 3; t.subclase = 'Beast Master';
    t.companion = { beast: 'land', name: 'Grum' }; Storage.saveChar(t);
    Storage.saveChar(Characters.buildLursey());
  });
  await p.click('#idxThemeBtn'); await sleep(150);
  const abierto = await p.evaluate(() => !document.getElementById('idxTemaPop').hidden && document.activeElement?.dataset.tema);
  chk('popover abre y enfoca la opción activa', abierto === 'dark', abierto);
  await p.click('[data-tema="slate-brass"]'); await sleep(150);
  t = await tema();
  const claves = await p.evaluate(() => [localStorage.dnd_theme, localStorage.dnd_theme_v1]);
  chk('elegir Pizarra aplica al instante y guarda', t.t === 'slate-brass' && t.nombre === 'Pizarra y latón' && claves.every(v => v === 'slate-brass'), { t, claves });
  await p.keyboard.press('Escape'); await sleep(100);
  chk('Escape cierra el popover', await p.evaluate(() => document.getElementById('idxTemaPop').hidden));
  const opts = await p.evaluate(() => { document.getElementById('idxTemaPop').hidden = false;
    return [...document.querySelectorAll('#temaSelectorIdx .tema-opt')].map(b => Math.round(b.getBoundingClientRect().height)); });
  chk('opciones con altura táctil ≥ 44px', opts.every(h => h >= 44), opts);
  await p.evaluate(() => { document.getElementById('idxTemaPop').hidden = true; });
  const auditIdx = await p.evaluate(AUDITAR);
  chk('inicio en Pizarra sin texto bajo contraste', auditIdx.malos.length === 0, auditIdx.malos.slice(0, 8));

  // Pasar a la ficha: el tema llega antes de pintar
  const ficha = async id => {
    await p.evaluate(id => { Storage.setActiveId(id); sessionStorage.setItem('dnd_playing', '1'); }, id);
    await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(2200);
  };
  await ficha('lursey-brumaclara');
  t = await tema();
  chk('la ficha abre en Pizarra desde el primer pintado', t.ini === 'slate-brass' && t.activo === 'slate-brass', t);

  // Contraste en Pizarra: Lursey (todas las pestañas, incluida Bastión) y Torvald
  const tabs = ['combate', 'habilidades', 'conjuros', 'equipo', 'bastion', 'biblioteca'];
  const auditar = async quien => {
    const todos = [];
    for (const tab of tabs) {
      const ok = await p.evaluate(tab => { const b = document.querySelector(`[data-tab="${tab}"]`); if (!b || b.style.display === 'none') return false; App.switchTab(tab); return true; }, tab);
      if (!ok) continue;
      await sleep(400);
      const a = await p.evaluate(AUDITAR);
      a.malos.forEach(m => todos.push({ tab, ...m }));
      console.log(`    ${quien}/${tab}: ${a.total} textos, ${a.malos.length} bajo contraste`);
    }
    return todos;
  };
  const malL = await auditar('Lursey');
  chk('Lursey en Pizarra sin texto bajo contraste', malL.length === 0, malL.slice(0, 12));

  // Estados: vida crítica + panel de combate, aviso y diálogo
  await p.evaluate(() => { const c = Storage.getChar('lursey-brumaclara'); c.hp.current = 6; App.reloadChar(c); App.switchTab('combate'); App.botonCombate(); });
  await sleep(500);
  const estados = [];
  const vida = await p.evaluate(() => getComputedStyle(document.getElementById('hdrHP')).color);
  let a = await p.evaluate(AUDITAR); a.malos.forEach(m => estados.push({ estado: 'vida crítica + combate', ...m }));
  await p.screenshot({ path: salida('tema_slate_vida_critica.png') });
  await p.evaluate(() => App.showToast('Aviso de prueba', 'error')); await sleep(300);
  a = await p.evaluate(AUDITAR); a.malos.forEach(m => estados.push({ estado: 'aviso', ...m }));
  await p.evaluate(() => { App.resetCombat?.(); App.openShortRest(); }); await sleep(400);
  a = await p.evaluate(AUDITAR); a.malos.forEach(m => estados.push({ estado: 'diálogo', ...m }));
  await p.screenshot({ path: salida('tema_slate_dialogo.png') });
  chk('vida crítica, combate, aviso y diálogo legibles en Pizarra', estados.length === 0 && vida === 'rgb(255, 147, 140)', { vida, estados: estados.slice(0, 10) });
  await p.keyboard.press('Escape');
  await p.evaluate(() => { const c = Storage.getChar('lursey-brumaclara'); c.hp.current = c.hp.max; App.reloadChar(c); });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(2000);

  // Menú: cambiar en vivo sin perder pestaña ni scroll
  await p.evaluate(() => App.switchTab('conjuros')); await sleep(300);
  const antes = await p.evaluate(() => {
    const sc = [...document.querySelectorAll('#tab-conjuros, #tab-conjuros *')].find(e => e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    if (sc) { sc.id = sc.id || 'scTema'; sc.scrollTop = 300; }
    return { id: sc?.id, top: sc?.scrollTop };
  });
  await p.click('#headerMenuToggle, .header-menu-toggle'); await sleep(200);
  await p.screenshot({ path: salida('tema_menu_slate.png') });
  await p.click('#temaSelectorApp [data-tema="light"]'); await sleep(200);
  const despues = await p.evaluate(id => ({ t: document.documentElement.dataset.theme,
    tab: document.querySelector('.tab-btn.active')?.dataset.tab, top: document.getElementById(id)?.scrollTop,
    menu: document.getElementById('headerMenuDropdown').classList.contains('open') }), antes.id);
  chk('Pergamino en vivo: misma pestaña y scroll, menú abierto', despues.t === 'light' && despues.tab === 'conjuros' && despues.top === antes.top && despues.menu, { antes, despues });
  await p.focus('#temaSelectorApp [aria-checked="true"]');
  await p.keyboard.press('ArrowUp'); await sleep(100);
  t = await tema();
  chk('flecha arriba pasa a Pizarra con teclado', t.t === 'slate-brass' && await p.evaluate(() => document.activeElement.dataset.tema) === 'slate-brass', t);
  await p.keyboard.press('Escape');
  await p.evaluate(() => App.closeHeaderMenu());

  await ficha('tv');
  const malT = await auditar('Torvald');
  chk('Torvald en Pizarra sin texto bajo contraste', malT.length === 0, malT.slice(0, 12));

  // Capturas de Combate en los tres temas (Lursey) y en iPad dividido
  await ficha('lursey-brumaclara');
  for (const id of ['dark', 'slate-brass', 'light']) {
    await p.evaluate(id => { Tema.aplicar(id, true); App.switchTab('combate'); }, id); await sleep(300);
    await p.screenshot({ path: salida(`tema_combate_${id}.png`) });
  }
  await p.setViewport({ width: 600, height: 900 }); await sleep(400);
  await p.evaluate(() => Tema.aplicar('slate-brass', true));
  await p.click('.header-menu-toggle'); await sleep(200);
  const ipad = await p.evaluate(() => ({ anchoPagina: document.documentElement.scrollWidth,
    opts: [...document.querySelectorAll('#temaSelectorApp .tema-opt')].map(b => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), dentro: r.left >= 0 && r.right <= innerWidth }; }) }));
  chk('iPad dividido (600px): opciones legibles y tocables, sin scroll horizontal', ipad.anchoPagina <= 600 && ipad.opts.every(o => o.h >= 44 && o.dentro), ipad);
  await p.screenshot({ path: salida('tema_ipad_600.png') });

  // Recargar conserva la elección
  await p.reload({ waitUntil: 'networkidle2' }); await sleep(1500);
  t = await tema();
  chk('recargar conserva Pizarra', t.ini === 'slate-brass', t);

  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
