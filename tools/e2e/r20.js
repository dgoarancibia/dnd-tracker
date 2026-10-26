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
  const nBtn = await p.evaluate(() => [...document.querySelectorAll('.r20-btn')].filter(b => getComputedStyle(b).display !== 'none').length);
  console.log('botones R20 visibles en escritorio:', nBtn);
  await p.evaluate(() => { App.copiarRoll20('skill', Characters.SKILLS_DEF[0].id); App.copiarRoll20('save', 'des'); App.copiarRoll20('stat', 'for'); App.copiarRoll20('init', ''); });
  await p.evaluate(() => App.attackWithWeapon('mainHand')); await sleep(300);
  await p.evaluate(() => [...document.querySelectorAll('#refFooter button')].find(b => /Roll20/.test(b.textContent)).click());
  await p.evaluate(() => App.closeActionRefModal());
  const sp = await p.evaluate(() => (App.getChar ? null : null) || JSON.parse(localStorage.getItem('dnd_chars'))?.tv?.spells?.map(s => s.id));
  const spells = await p.evaluate(() => { const all = Storage.getAllChars(); return (all.tv.spells || []).map(s => s.id); });
  console.log('conjuros:', spells.join(', '));
  for (const id of spells.slice(0, 2)) { await p.evaluate(id => { App.copiarRoll20('conjuro', id); App.copiarRoll20('conjuro-desc', id); }, id); }
  await sleep(300);
  // hover skill row + screenshot
  const row = (await p.$$('.skill-row'))[1]; if (row) await row.hover();
  await sleep(200);
  await p.screenshot({ path: salida('r20_desk.png') });
  for (const t of await p.evaluate(() => window.__copiado)) console.log('---\n' + t);
  // iPad
  await p.setViewport({ width: 1180, height: 820, hasTouch: true, isMobile: true });
  await sleep(500);
  console.log('iPad matchMedia:', await p.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches), 'visibles:', await p.evaluate(() => [...document.querySelectorAll('.solo-desktop')].filter(b => getComputedStyle(b).display !== 'none').length));
  await browser.close();
})();
