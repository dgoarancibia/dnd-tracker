// Menú ⋯ de la ficha: grupos plegables, que no se salga de la pantalla,
// que recuerde qué grupo quedó abierto y que Deshacer deshaga un solo cambio.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE, salida } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };

  await p.setViewport({ width: 1440, height: 760 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1');
    const t = Characters.createNew('Torvald Ironhollow', 'Explorador'); t.id = 'tv'; t.nivel = 3; t.subclase = 'Beast Master';
    Storage.saveChar(t); Storage.setActiveId('tv'); sessionStorage.setItem('dnd_playing', '1');
  });
  const abrir = async () => {
    await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);
    await p.click('#headerMenuToggle'); await sleep(200);
  };
  const medir = () => p.evaluate(() => {
    const dd = document.getElementById('headerMenuDropdown'); const r = dd.getBoundingClientRect();
    return { abajo: Math.round(r.bottom), alto: innerHeight, izq: Math.round(r.left), ancho: innerWidth,
      scroll: dd.scrollHeight > dd.clientHeight, pagina: document.documentElement.scrollWidth,
      grupos: [...dd.querySelectorAll('.hm-grupo')].map(g => ({ id: g.dataset.grupo, open: g.open, n: g.querySelector('.hm-grupo-n')?.textContent })) };
  });

  await abrir();
  let m = await medir();
  chk('empieza con los grupos cerrados y con su cantidad (invitado: sin las 3 de la nube)', m.grupos.every(g => !g.open) && m.grupos.map(g => g.n).join() === '4,3,3', m.grupos);
  chk('cerrado cabe entero en 1440×760', m.abajo <= m.alto && !m.scroll, m);
  const temas = await p.evaluate(() => [...document.querySelectorAll('#temaSelectorApp .tema-opt')].map(b => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), top: Math.round(r.top) }; }));
  chk('Apariencia en una fila, opciones ≥ 44px', new Set(temas.map(t => t.top)).size === 1 && temas.every(t => t.h >= 44), temas);
  await p.screenshot({ path: salida('menu_cerrado_1440.png') });
  const fabs = await p.evaluate(() => [...document.querySelectorAll('.fab, .fab-note')].filter(f => f.offsetParent).map(f => getComputedStyle(f).pointerEvents));
  chk('con el menú abierto los botones flotantes se esconden', fabs.every(v => v === 'none'), fabs);

  await p.click('.hm-grupo[data-grupo="guardado"] summary'); await sleep(150);
  await p.click('.hm-grupo[data-grupo="partida"] summary'); await sleep(150);
  m = await medir();
  chk('abrir grupos no cierra el menú', await p.evaluate(() => document.getElementById('headerMenuDropdown').classList.contains('open')));
  chk('dos grupos abiertos: no pasa del borde de la pantalla', m.abajo <= m.alto, m);
  await p.screenshot({ path: salida('menu_abierto_1440.png') });

  // Recordar grupos al volver a abrir
  await abrir();
  m = await medir();
  chk('recuerda los grupos abiertos', m.grupos.filter(g => g.open).map(g => g.id).join() === 'partida,guardado', m.grupos);

  // Todo abierto en pantallas bajas: scroll dentro del menú, sin salirse
  await p.evaluate(() => document.querySelectorAll('.hm-grupo').forEach(g => { g.open = true; }));
  for (const [w, h] of [[1440, 600], [600, 800], [375, 700]]) {
    await p.setViewport({ width: w, height: h }); await abrir();
    await p.evaluate(() => document.querySelectorAll('.hm-grupo').forEach(g => { g.open = true; }));
    m = await medir();
    const fondo = await p.evaluate(() => { const dd = document.getElementById('headerMenuDropdown'); dd.scrollTop = dd.scrollHeight;
      const r = document.getElementById('logoutBtn').offsetParent ? document.getElementById('logoutBtn') : document.getElementById('loginBtn');
      const b = r.getBoundingClientRect(); return Math.round(b.bottom) <= innerHeight; });
    chk(`${w}×${h}: todo abierto se lee con scroll y llega a la cuenta`, m.abajo <= m.alto && m.izq >= 0 && m.pagina <= w && fondo, m);
    await p.screenshot({ path: salida(`menu_${w}x${h}.png`) });
  }
  await p.setViewport({ width: 1440, height: 760 });

  // Deshacer: un clic = un cambio
  await abrir(); await p.evaluate(() => App.closeHeaderMenu());
  const deshacer = await p.evaluate(async () => {
    // Dos cambios de vida seguidos (setHP registra deshacer) y un solo Deshacer
    const n = () => Storage.getChar('tv').hp.current;
    const base = n();
    App.setHP(base - 1); App.setHP(base - 2);
    const tras = n();
    document.getElementById('headerMenuToggle').click(); document.getElementById('undoBtn').click();
    await new Promise(r => setTimeout(r, 100));
    return { base, tras, final: n() };
  });
  chk('Deshacer deshace un solo cambio', !deshacer.error && deshacer.tras === deshacer.base - 2 && deshacer.final === deshacer.base - 1, deshacer);

  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
