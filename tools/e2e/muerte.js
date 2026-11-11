// Tiradas de muerte en Mesa: aparecen al llegar a 0 PG, se marcan con los
// botones rápidos, se pueden minimizar y se limpian al curarse.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };
  await p.setViewport({ width: 1180, height: 820 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1'); localStorage.setItem('dnd_vista', 'mesa');
    const c = Characters.createNew('Prueba Muerte', 'Guerrero'); c.id = 'mu';
    Storage.saveChar(c); Storage.setActiveId('mu'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')));

  const leer = () => p.evaluate(() => { const card = document.querySelector('#mesa-combate .mesa-muerte'); const c = App.getActiveChar();
    return { card: !!card, min: !!(card && card.classList.contains('min')), txt: card ? card.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) : '',
      ex: document.querySelectorAll('#mesa-combate .mesa-ds i.success.on').length, fa: document.querySelectorAll('#mesa-combate .mesa-ds i.failure.on').length,
      ds: c.deathSaves, pg: c.hp.current }; });

  chk('con PG: no hay tarjeta', !(await leer()).card);
  await p.evaluate(() => App.adjustHP(-999)); await sleep(400);
  const caido = await leer();
  chk('a 0 PG aparece la tarjeta, primero en la columna', caido.card && !caido.min && caido.pg === 0
    && await p.evaluate(() => document.querySelector('#mesa-combate .mesa-der section').contains(document.querySelector('.mesa-muerte'))), caido);

  const clic = async t => { await p.evaluate(t => [...document.querySelectorAll('#mesa-combate .mesa-muerte .mesa-chip')].find(b => b.textContent.includes(t)).click(), t); await sleep(300); };
  await clic('éxito'); await clic('2–9');
  let r = await leer(); chk('éxito y fallo marcados', r.ex === 1 && r.fa === 1, r.ds);
  await clic('1 natural'); r = await leer();
  chk('1 natural suma 2 fallos → 3 y queda Muerto', r.fa === 3 && /Muerto/.test(r.txt), r);
  await p.evaluate(() => App.toggleDeathSave('failure', 0)); await sleep(300);   // tocar el primer punto lo baja a 0
  r = await leer(); chk('tocar un punto lo corrige', r.fa === 0, r.ds);

  await p.evaluate(() => [...document.querySelectorAll('.mesa-muerte .mesa-plegar')][0].click()); await sleep(300);
  r = await leer(); chk('minimizar deja una franja con el marcador', r.min && /Caído/.test(r.txt) && r.ex === 1, r);
  await p.evaluate(() => App.switchTab('conjuros')); await sleep(200);
  await p.evaluate(() => App.switchTab('combate')); await sleep(300);
  await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')));
  await p.screenshot({ path: __dirname + '/out/muerte_min_1180.png' });
  await p.evaluate(() => [...document.querySelectorAll('.mesa-muerte .mesa-plegar')][0].click()); await sleep(300);
  await p.screenshot({ path: __dirname + '/out/muerte_1180.png' });

  await clic('20 natural'); r = await leer();
  chk('20 natural: 1 PG, tarjeta fuera y tiradas limpias', !r.card && r.pg === 1 && r.ds.successes === 0 && r.ds.failures === 0, r);
  await p.evaluate(() => { App.adjustHP(-999); }); await sleep(400);
  r = await leer(); chk('nueva caída: vuelve desplegada y en cero', r.card && !r.min && r.ex === 0 && r.fa === 0, r);

  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
