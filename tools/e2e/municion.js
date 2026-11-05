// Atacar con un arco equipado desde la mochila (id 'w-<fecha>') descuenta una flecha
// del ítem "Flechas" de Ítems; al recuperar vuelve la mitad de lo disparado.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1');
    const t = Characters.createNew('Torvald', 'Explorador'); t.id = 'mun'; t.nivel = 3;
    t.equipment = { ...(t.equipment || {}), mainHand: { id: 'w-123', name: 'Longbow', kind: 'weapon', die: '1d8', type: 'ranged',
      statUsed: 'dex', bonuses: { ac: 0, attack: 0, damage: 0, save: 0 }, buffs: [] } };
    t.consumables = [{ name: 'Carcaj', qty: 1 }, { name: 'Flechas (20)', qty: 1, category: 'Ammunition' }];
    Storage.saveChar(t); Storage.setActiveId('mun'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(2500);
  await p.evaluate(() => App.attackWithWeapon('mainHand')); await sleep(300);
  await p.evaluate(() => App.attackWithWeapon('mainHand')); await sleep(300);
  const a = await p.evaluate(() => { const c = Storage.getChar('mun'); return { item: c.consumables[1], carcaj: c.consumables[0].qty, spent: c.ammo.arrow.spent }; });
  await p.evaluate(() => App.recuperarMunicion('arrow')); await sleep(300);
  a.recuperadas = await p.evaluate(() => Storage.getChar('mun').consumables[1].qty);
  const ok = a.item.name === 'Flechas' && a.item.qty === 18 && a.carcaj === 1 && a.spent === 2 && a.recuperadas === 19;
  console.log(JSON.stringify(a), ok ? '\nTODO OK' : '\nHAY FALLAS');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
