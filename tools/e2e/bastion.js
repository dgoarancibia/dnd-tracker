// Bastión de Lursey: pestaña visible, instalaciones según nivel, Storehouse
// con recargo, turno registrado y Charm del Sanctuary como recurso.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE, salida } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.setViewport({ width: 1180, height: 820 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1');
    const l = Characters.buildLursey(); l.nivel = 7; delete l.bastion;
    Storage.saveChar(l); Storage.setActiveId(l.id); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(2500);
  const res = [];
  const chk = (n, ok, d) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', n, d !== undefined ? JSON.stringify(d) : ''); };
  const b = () => p.evaluate(() => JSON.parse(JSON.stringify(Storage.getChar('lursey-brumaclara').bastion || null)));

  chk('pestaña visible', await p.evaluate(() => getComputedStyle(document.getElementById('tabBtnBastion')).display !== 'none'));
  await p.evaluate(() => App.switchTab('bastion')); await sleep(300);
  chk('cupos nv7 = 2', await p.evaluate(() => Bastion.cuposEspeciales(7) === 2 && Bastion.cuposEspeciales(9) === 4));

  await p.evaluate(() => { Bastion.agregarEspecial('sanctuary'); Bastion.agregarEspecial('storehouse'); Bastion.agregarEspecial('library'); });
  await sleep(300);
  let x = await b();
  chk('solo 2 especiales', x.especiales.length === 2, x.especiales.map(e => e.tipo));
  await p.evaluate(() => Bastion.agregarEspecial('greenhouse')); await sleep(100);
  chk('nivel 9 bloqueada', (await b()).especiales.length === 2);

  await p.evaluate(() => {
    document.getElementById('bstMercNombre').value = 'Seda';
    document.getElementById('bstMercCant').value = '10';
    document.getElementById('bstMercValor').value = '10';
    Bastion.agregarMercaderia();
  }); await sleep(300);
  const venta = await p.evaluate(() => document.querySelector('.bst-tabla tfoot .bst-venta').textContent);
  chk('venta con +10%', /110/.test(venta), venta);

  await p.evaluate(() => {
    const e = Storage.getChar('lursey-brumaclara').bastion.especiales;
    const sel = [...document.querySelectorAll('.bst-orden select')];
    sel[1].value = 'trade'; sel[1].dispatchEvent(new Event('change'));
    Bastion.cerrarTurno();
  }); await sleep(300);
  x = await b();
  chk('turno registrado y órdenes limpias', x.turnos.length === 1 && x.turnos[0].ordenes[0].orden === 'trade' && x.especiales.every(e => !e.orden), x.turnos);

  await p.evaluate(() => Bastion.descansoEnBastion()); await sleep(300);
  const charm = await p.evaluate(() => (Storage.getChar('lursey-brumaclara').resources || []).find(r => r.id === 'charm-sanctuary'));
  chk('Charm del Sanctuary en recursos', charm && charm.current === 1 && /Healing Word/.test(charm.desc), charm && charm.desc);
  await p.screenshot({ path: salida('bastion.png'), fullPage: false });

  const ok = res.every(Boolean);
  console.log(ok ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
