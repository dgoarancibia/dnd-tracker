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
  const leer = () => p.evaluate(() => [...document.querySelectorAll('.stat-block-val')].map(e => e.id + '=' + e.textContent).join(' ') + ' | sab-skill ' + [...document.querySelectorAll('.skill-row')].map(r=>r.innerText.replace(/\s+/g,' ')).find(t=>/Percepci/.test(t)));
  console.log('antes:', await leer());
  await p.evaluate(() => App.openEditStats());
  await p.evaluate(() => { document.getElementById('es-stat-sab').value = 18; App.saveEditStats(); });
  await sleep(400);
  console.log('después:', await leer());
  await browser.close();
})();
