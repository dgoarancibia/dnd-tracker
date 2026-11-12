// HU-36 descanso largo 2024 (todos los dados de golpe, avisos por clase, Humano gana
// Inspiración, eco/resistencia/marca se limpian) y HU-43 "Antes de jugar" (avisos con arreglo).
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  await p.setViewport({ width: 1180, height: 820 });
  p.on('pageerror', e => console.log('ERROR:', e.message));
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => { localStorage.setItem('dnd_guest', '1'); localStorage.setItem('dnd_vista', 'mesa');
    const c = Characters.createNew('Torvald', 'Explorador'); c.id = 'tvd'; c.nivel = 4; c.subclase = 'Beast Master'; c.raza = 'Humano';
    c.classes = [{ name: 'Explorador', level: 4, subclass: 'Beast Master' }];
    Storage.saveChar(c); Storage.setActiveId('tvd'); sessionStorage.setItem('dnd_playing', '1'); });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);

  // Estado "sesión anterior": todo gastado y colgado
  await p.evaluate(() => { const c = App.getActiveChar();
    c.hp.current = 10; c.hp.temp = 4; c.hitDice = { current: 0, max: 4 }; c.spellSlots[1].current = 0;
    c.conditions = ['envenenado']; c.markTarget = 'Orco'; c.turn = { action: true, bonus: false, reaction: false, movement: false };
    c.companion = { beast: 'land', summoned: true, name: 'Grum', hp: 0 }; c.inspiration = false; c.resistTodo = { fuente: 'x' };
    c.deathSaves = { successes: 1, failures: 0 };
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')); App.saveActive && App.saveActive(); });
  await p.evaluate(() => Mesa.render && Mesa.render());
  const n = await p.evaluate(() => App.prepAvisosCount());
  chk('contador de avisos', n >= 6, n);

  await p.evaluate(() => App.openPrepSesion());
  const av = await p.evaluate(() => [...document.querySelectorAll('#prepSesionOverlay .prep-av')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  chk('avisos: gastado, temporales, marca, condición, muerte, turno, resistencia, Grum caído',
    ['gastadas', 'temporales', 'Orco', 'Envenenado', 'muerte', 'turno', 'resistencia', 'caído'].every(k => av.some(a => a.toLowerCase().includes(k.toLowerCase()))), av);
  await p.evaluate(() => App.prepArreglar('cond'));
  const cond = await p.evaluate(() => ({ c: App.getActiveChar().conditions.length, abierto: document.getElementById('prepSesionOverlay').style.display }));
  chk('Quitar condiciones arregla y deja el modal abierto', cond.c === 0 && cond.abierto === 'flex', cond);
  const sinEmoji = await p.evaluate(() => !/[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById('prepSesionOverlay').textContent));
  chk('modal sin emojis', sinEmoji);

  // Descanso largo desde el aviso
  await p.evaluate(() => App.prepArreglar('largo')); await sleep(200);
  const prev = await p.evaluate(() => document.getElementById('lrSummary').textContent.replace(/\s+/g, ' '));
  chk('vista previa: dados 0 → 4, Grum vuelve, Inspiración, cambiar 1 preparado',
    /Dados de golpe 0 → 4/.test(prev) && /Grum vuelve/.test(prev) && /Inspiración heroica/.test(prev) && /cambiar 1 conjuro preparado/.test(prev), prev);
  await p.evaluate(() => App.applyLongRest()); await sleep(200);
  const d = await p.evaluate(() => { const c = App.getActiveChar(); return { hd: c.hitDice.current, insp: c.inspiration, marca: c.markTarget || null,
    resist: !!c.resistTodo, grum: c.companion.hp, ds: c.deathSaves.successes, n: App.prepAvisosCount() }; });
  chk('tras descansar: 4/4 dados, inspiración, sin marca ni resistencia, Grum 25, 0 avisos', d.hd === 4 && d.insp && !d.marca && !d.resist && d.grum === 25 && d.ds === 0 && d.n === 0, d);
  await p.evaluate(() => App.openPrepSesion());
  const ok = await p.evaluate(() => document.querySelector('#prepSesionOverlay .prep-ok') ? document.querySelector('#prepSesionOverlay .prep-ok').textContent : '');
  chk('Antes de jugar dice "Todo listo"', /Todo listo/.test(ok), ok);
  await p.screenshot({ path: process.env.SHOT || '/tmp/prep.png' });
  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
