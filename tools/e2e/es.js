const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE, salida } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.evaluateOnNewDocument(() => {
    window.__copiado = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__copiado.push(t); } } });
  });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1');
    const c = Characters.createNew('Torvald Ironhollow', 'Explorador'); c.id = 'tv'; c.nivel = 3;
    c.stats = { for: 12, des: 16, con: 14, int: 10, sab: 15, car: 8 };
    c.savingThrows = ['for', 'des']; c.skillProfs = ['perception', 'stealth'];
    c.equipment = c.equipment || {};
    c.equipment.mainHand = { id: 'w1', name: 'Arco largo', kind: 'weapon', die: '1d8', bonus: 0 }; c.choices = { ...(c.choices||{}), 'fighting-style-r': 'fs-archery' };
    Storage.saveChar(c); Storage.setActiveId('tv'); sessionStorage.setItem('dnd_playing', '1');
  });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(3000);
  await p.evaluate(() => window.scrollTo(0, 0));
  const el = await p.$('.feat-card'); if (el) await el.scrollIntoView();
  await sleep(300); await p.screenshot({ path: salida('es_desk.png') });
  await p.evaluate(() => App.openSpellDetail('hunters-mark')); await sleep(300);
  await p.screenshot({ path: salida('es_spell.png') });
  await p.evaluate(() => App.closeSpellDetail());
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await sleep(600);
  const el2 = await p.$('.feat-card'); if (el2) await el2.scrollIntoView();
  await sleep(300); await p.screenshot({ path: salida('es_mob.png') });
  console.log(await p.evaluate(() => [...document.querySelectorAll('.feat-name, .spell-name')].slice(0,12).map(e=>e.textContent).join(' | ')));
  await browser.close();
})();
