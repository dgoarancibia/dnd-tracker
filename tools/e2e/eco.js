// Echo Knight en Mesa: tarjeta morada del eco en la columna derecha,
// invocar gasta la Adicional, el distintivo aparece en la cabecera.
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
    const c = Characters.createNew('Prueba Eco', 'Guerrero'); c.id = 'eco';
    c.stats = { for: 19, des: 12, con: 15, int: 10, sab: 13, car: 8 };
    c.choices = { 'fighting-style': 'fs-defense' };
    Characters.applyLevelUp(c, 5, 40); Characters.applySubclass && Characters.applySubclass(c, 'Echo Knight');
    c.subclase = 'Echo Knight';
    c.equipment = { mainHand: { kind: 'weapon', name: 'Lanza', die: '1d6', statUsed: 'str', type: 'melee' } };
    Storage.saveChar(c); Storage.setActiveId('eco'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  const cerrar = () => p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')));
  await cerrar();
  const leer = () => p.evaluate(() => { const k = document.querySelector('#mesa-combate .mesa-der .mesa-eco'); const c = App.getActiveChar();
    return { card: !!k, on: !!(k && k.classList.contains('on')), txt: k ? k.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : '',
      dis: !!(k && k.querySelector('.mesa-eco-btn:disabled')), chip: !!document.querySelector('.mc-quien .mc-eco'), activo: !!c.echoActive, bonus: !!(c.turn && c.turn.bonus) }; });

  let r = await leer();
  chk('sin invocar: tarjeta con botón Invocar, sin distintivo', r.card && !r.on && /Invocar eco/.test(r.txt) && !r.chip, r);
  await p.evaluate(() => Mesa.combate(true)); await sleep(300); await cerrar();
  await p.evaluate(() => document.querySelector('.mesa-eco .mesa-eco-btn').click()); await sleep(400);
  r = await leer();
  chk('invocar: eco activo, gasta la Adicional, distintivo morado en cabecera', r.on && r.activo && r.bonus && r.chip && /CA\s*17|17\s*CA/.test(r.txt.replace(/\s/g, ' ')) || (r.on && r.activo && r.bonus && r.chip), r);
  chk('activo: CA 14 + BC 3 = 17 y 1 PG', await p.evaluate(() => [...document.querySelectorAll('.mesa-eco-stats b')].map(b => b.textContent).join('|')) .then(x => x.startsWith('17|1|')));
  r = await leer(); chk('con la Adicional gastada, Intercambiar queda deshabilitado', r.dis, r);
  await cerrar(); await p.screenshot({ path: __dirname + '/out/eco_activo_1180.png' });
  await p.evaluate(() => [...document.querySelectorAll('.mesa-eco .mesa-btn')].find(b => /Descartar/.test(b.textContent)).click()); await sleep(400);
  r = await leer(); chk('descartar: vuelve a sin invocar y se quita el distintivo', r.card && !r.on && !r.activo && !r.chip, r);
  await cerrar(); await p.screenshot({ path: __dirname + '/out/eco_inactivo_1180.png' });
  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
