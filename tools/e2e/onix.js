// Tema Ónix y granate: contraste en todas las pestañas y estados, íconos grabados
// en lugar de emoji (y vuelta atrás al cambiar de tema), características al estilo
// D&D Beyond, CA en escudo, anchos 375/600 sin scroll horizontal y offline.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const AUDITAR = require('./contraste');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  const fallidos = [];
  p.on('response', r => { if (r.status() >= 400) fallidos.push(r.status() + ' ' + r.url()); });
  await p.setViewport({ width: 1440, height: 900 });
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };

  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1'); localStorage.setItem('dnd_theme', 'onix'); localStorage.setItem('dnd_theme_v1', 'onix');
    const t = Characters.createNew('Torvald Ironhollow', 'Explorador'); t.id = 'tv'; t.nivel = 3; t.subclase = 'Beast Master';
    t.companion = { beast: 'land', name: 'Grum' }; t.conditions = ['Caído'];
    Storage.saveChar(t); Storage.saveChar(Characters.buildLursey());
  });
  await p.reload({ waitUntil: 'networkidle2' }); await p.evaluate(() => skipLogin()); await sleep(400);
  chk('elegido en el inicio: Ónix y granate', await p.evaluate(() => document.documentElement.dataset.theme === 'onix' && document.querySelector('[data-tema-nombre]').textContent === 'Ónix y granate'));
  let a = await p.evaluate(AUDITAR);
  chk('inicio legible', a.malos.length === 0, a.malos.slice(0, 8));

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
      for (const pos of [0, 0.5, 1]) {
        await p.evaluate(pos => document.querySelectorAll('.tab-panel.active, .tab-panel.active *, .stats-sidebar').forEach(e => {
          if (e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)) e.scrollTop = (e.scrollHeight - e.clientHeight) * pos; }), pos);
        await sleep(120);
        (await p.evaluate(AUDITAR)).malos.forEach(m => malos.push({ tab, ...m }));
      }
    }
    const unicos = [...new Map(malos.map(m => [m.k, m])).values()];
    console.log(`    ${quien}: ${unicos.length} combinaciones bajo contraste`);
    return unicos;
  };

  await ficha('tv');
  const ic = await p.evaluate(() => {
    const vis = e => e && getComputedStyle(e).display !== 'none';
    const tabs = [...document.querySelectorAll('.tab-btn .tab-ic')];
    const stat = document.querySelector('.stats-strip-bar .stat-block');
    const val = stat.querySelector('.stat-block-val').getBoundingClientRect(), caja = stat.getBoundingClientRect();
    return {
      tabsIco: tabs.every(t => vis(t.querySelector('.ico')) && !vis(t.querySelector('.emo-orig'))),
      titulos: [...document.querySelectorAll('.section-hd')].filter(h => h.offsetParent).map(h => !!h.querySelector('.ico')).filter(Boolean).length,
      stats: document.querySelectorAll('.stat-block-name .ico').length,
      dado: !!document.querySelector('.rc-name .ico'),
      cond: !!document.querySelector('.cond-btn .ico'),
      parentesis: getComputedStyle(stat.querySelector('.sbm-p')).display,
      ovalo: Math.round(val.bottom - caja.bottom),
      escudo: /escudo/.test(getComputedStyle(document.querySelector('.stats-strip .stat-box')).backgroundImage),
      marco: /marco/.test(getComputedStyle(stat).borderImageSource),
      emblema: getComputedStyle(document.body, '::before').pointerEvents,
    };
  });
  chk('íconos grabados en pestañas, títulos, características, dados y condiciones', ic.tabsIco && ic.titulos >= 3 && ic.stats === 6 && ic.dado && ic.cond, ic);
  chk('características como D&D Beyond: sin paréntesis y el puntaje en un óvalo sobre el borde', ic.parentesis === 'none' && ic.ovalo > 0 && ic.marco, ic);
  chk('CA en escudo y emblema de fondo sin interceptar toques', ic.escudo && ic.emblema === 'none', ic);
  const malT = await auditar('Torvald');
  chk('Torvald legible en todas las pestañas', malT.length === 0, malT.slice(0, 12));

  await ficha('lursey-brumaclara');
  const malL = await auditar('Lursey');
  chk('Lursey legible en todas las pestañas (incluye Bastión)', malL.length === 0, malL.slice(0, 12));
  await p.evaluate(() => { const c = Storage.getChar('lursey-brumaclara'); c.hp.current = 6; App.reloadChar(c); App.switchTab('combate'); App.botonCombate(); });
  await sleep(500);
  const est = [];
  (await p.evaluate(AUDITAR)).malos.forEach(m => est.push({ estado: 'combate', ...m }));
  await p.evaluate(() => App.showToast('Aviso de prueba', 'error')); await sleep(250);
  (await p.evaluate(AUDITAR)).malos.forEach(m => est.push({ estado: 'aviso', ...m }));
  await p.evaluate(() => { App.resetCombat?.(); App.openShortRest(); }); await sleep(400);
  (await p.evaluate(AUDITAR)).malos.forEach(m => est.push({ estado: 'diálogo', ...m }));
  chk('vida crítica, combate, aviso y diálogo legibles', est.length === 0, est.slice(0, 10));
  await p.evaluate(() => { const c = Storage.getChar('lursey-brumaclara'); c.hp.current = c.hp.max; App.reloadChar(c); });

  // Menú: las cuatro opciones caben en la fila
  await ficha('tv');
  await p.click('#headerMenuToggle'); await sleep(200);
  const menu = await p.evaluate(() => [...document.querySelectorAll('#temaSelectorApp .tema-opt')].map(b => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), corta: b.scrollWidth > b.clientWidth + 1 }; }));
  chk('menú: cuatro temas en la fila, ≥ 44px y sin texto cortado', menu.length === 4 && menu.every(o => o.h >= 44 && !o.corta), menu);
  await p.evaluate(() => App.closeHeaderMenu());

  // Volver a otro tema: reaparecen los emoji y se ocultan los íconos, sin recargar
  await p.evaluate(() => Tema.aplicar('dark', true)); await sleep(150);
  const vuelta = await p.evaluate(() => ({ emo: getComputedStyle(document.querySelector('.tab-ic .emo-orig')).display, ico: getComputedStyle(document.querySelector('.tab-ic .ico')).display }));
  chk('Clásico vuelve a mostrar los emoji', vuelta.emo !== 'none' && vuelta.ico === 'none', vuelta);
  await p.evaluate(() => Tema.aplicar('onix', true)); await sleep(150);

  // Anchos angostos sin scroll horizontal
  const malos = [];
  for (const w of [600, 375]) {
    for (const id of ['lursey-brumaclara', 'tv']) {
      await ficha(id, w);
      for (const tab of tabs) {
        await p.evaluate(tab => { const b = document.querySelector(`[data-tab="${tab}"]`); if (b && b.style.display !== 'none') App.switchTab(tab); }, tab); await sleep(150);
        const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
        if (ancho > w) malos.push({ id, tab, w, ancho });
      }
    }
  }
  chk('600 y 375: sin scroll horizontal', malos.length === 0, malos);
  chk('todos los recursos cargan', fallidos.filter(u => /onix|iconos|tema/.test(u)).length === 0, fallidos.slice(0, 5));

  // Sin conexión
  await ficha('tv');
  await p.evaluate(() => navigator.serviceWorker.ready); await sleep(2500);
  await p.setOfflineMode(true);
  await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(2500);
  const off = await p.evaluate(() => ({ t: document.documentElement.dataset.theme, marco: /marco/.test(getComputedStyle(document.querySelector('.stat-block')).borderImageSource),
    ico: getComputedStyle(document.querySelector('.tab-ic .ico')).display }));
  chk('sin conexión: Ónix con marcos e íconos', off.t === 'onix' && off.marco && off.ico !== 'none', off);

  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
