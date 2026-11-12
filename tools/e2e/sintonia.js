// Objetos mágicos: bonos (CA, salvaciones, CD/ataque de conjuros) que solo cuentan
// sintonizados, y sintonía de objetos que no se equipan (en la mochila).
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
  await p.evaluate(() => { localStorage.setItem('dnd_guest', '1');
    const c = Characters.createNew('Prueba Sintonía', 'Clérigo'); c.id = 'si'; c.stats.sab = 16; c.stats.des = 12;
    Storage.saveChar(c); Storage.setActiveId('si'); sessionStorage.setItem('dnd_playing', '1'); });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show')); App.switchTab('equipo'); });
  const nums = () => p.evaluate(() => { const c = App.getActiveChar(); return { ca: Characters.calcCA(c), sab: Characters.calcSave(c, 'sab'), cd: Characters.calcCD(c), atq: Characters.calcAtaqueBonus(c),
    sint: Characters.calcAttunementCount(c.equipment, c.consumables) }; });
  const antes = await nums();

  // Anillo de protección: +1 CA y +1 salvaciones, requiere sintonía
  await p.evaluate(() => { App._crearParaSlot('ring'); });
  await sleep(200);
  await p.evaluate(() => { document.getElementById('wondrousNameInput').value = 'Anillo de protección'; document.getElementById('wondrousAttuneCheck').checked = true;
    document.getElementById('wndBono-ac').value = '1'; document.getElementById('wndBono-save').value = '1'; App._saveWondrousModal(); });
  await sleep(300);
  const sin = await nums();
  chk('anillo sin sintonizar: no suma nada', sin.ca === antes.ca && sin.sab === antes.sab, { antes, sin });
  await p.evaluate(() => App.toggleAttunement('ring')); await sleep(200);
  const con = await nums();
  chk('anillo sintonizado: +1 CA y +1 a las salvaciones', con.ca === antes.ca + 1 && con.sab === antes.sab + 1 && con.sint === 1, con);

  // Amuleto del devoto +1: CD y ataque de conjuros
  await p.evaluate(() => { App._crearParaSlot('neck'); });
  await sleep(200);
  await p.evaluate(() => { document.getElementById('wondrousNameInput').value = 'Amulet of the Devout +1'; document.getElementById('wondrousAttuneCheck').checked = true;
    document.getElementById('wndBono-cd').value = '1'; document.getElementById('wndBono-spellAtk').value = '1'; App._saveWondrousModal(); App.toggleAttunement('neck'); });
  await sleep(300);
  const am = await nums();
  chk('amuleto sintonizado: +1 CD y +1 ataque de conjuros', am.cd === antes.cd + 1 && am.atq === antes.atq + 1 && am.sint === 2, am);
  // Editar el amuleto conserva los bonos en el formulario
  await p.evaluate(() => App._slotOptEdit('neck')); await sleep(200);
  chk('al editar, el formulario trae los bonos', await p.evaluate(() => document.getElementById('wndBono-cd').value === '1'));
  await p.evaluate(() => App._closeWondrousModal());

  // Brújula en la mochila: requiere sintonía sin equiparse
  await p.evaluate(() => { App.openAddItem('bag'); document.getElementById('aimName').value = 'Brújula del errante'; document.getElementById('aimCategory').value = 'Magic item';
    document.getElementById('aimAttune').checked = true; App.saveAddItem(); });
  await sleep(300);
  const badge = await p.evaluate(() => [...document.querySelectorAll('.item-row')].find(r => /Brújula/.test(r.textContent))?.querySelector('.equip-attune-badge')?.textContent.trim());
  chk('la brújula en la mochila muestra "necesita sintonía"', /necesita sintonía/.test(badge || ''), badge);
  await p.evaluate(() => [...document.querySelectorAll('.item-row')].find(r => /Brújula/.test(r.textContent)).querySelector('.equip-attune-badge').click()); await sleep(300);
  const br = await nums();
  chk('sintonizar la brújula: cuenta en la barra (3/3)', br.sint === 3 && /3\/3/.test(await p.evaluate(() => document.querySelector('.attunement-bar-count')?.textContent || '')), br);
  // Un cuarto objeto no se puede sintonizar
  await p.evaluate(() => { App.openAddItem('bag'); document.getElementById('aimName').value = 'Orbe'; document.getElementById('aimAttune').checked = true; App.saveAddItem(); });
  await sleep(300);
  await p.evaluate(() => [...document.querySelectorAll('.item-row')].find(r => /Orbe/.test(r.textContent)).querySelector('.equip-attune-badge').click()); await sleep(300);
  chk('el cuarto objeto no se sintoniza (máximo 3)', (await nums()).sint === 3);
  await p.screenshot({ path: __dirname + '/out/sintonia_1180.png' });
  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
