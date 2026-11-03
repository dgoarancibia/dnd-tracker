// Capturas de Pergamino: Lursey y Torvald (Combate), Bastión, diálogo, en 1440/560/480/375.
// Uso: node tools/e2e/pergamino_capturas.js [carpeta]   (por defecto tools/e2e/out/pergamino)
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dir = path.resolve(process.argv[2] || path.join(__dirname, 'out', 'pergamino'));
fs.mkdirSync(dir, { recursive: true });
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1'); localStorage.setItem('dnd_theme', 'light'); localStorage.setItem('dnd_theme_v1', 'light');
    const t = Characters.createNew('Torvald Ironhollow', 'Explorador'); t.id = 'tv'; t.nivel = 3; t.subclase = 'Beast Master';
    t.companion = { beast: 'land', name: 'Grum' };
    const arma = (id, name, type, die) => ({ id, name, kind: 'weapon', die, type, bonuses: { ac: 0, attack: 0, damage: 0, save: 0 }, buffs: [] });
    t.equipment = { ...(t.equipment || {}), mainHand: arma('longbow', 'Longbow', 'ranged', '1d8'), offHand: arma('shortsword', 'Shortsword', 'melee', '1d6') };
    Storage.saveChar(t);
    Storage.saveChar(Characters.buildLursey());
  });
  const abrir = async (id, w) => {
    await p.setViewport({ width: w, height: 900 });
    await p.evaluate(id => { Storage.setActiveId(id); sessionStorage.setItem('dnd_playing', '1'); }, id);
    await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1800);
  };
  for (const w of [1440, 560, 480, 375]) {
    for (const [id, nm] of [['lursey-brumaclara', 'lursey'], ['tv', 'torvald']]) {
      await abrir(id, w);
      await p.evaluate(() => App.switchTab('combate')); await sleep(300);
      const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
      if (ancho > w) console.log(`SCROLL HORIZONTAL ${nm} ${w}: ${ancho}`);
      await p.screenshot({ path: path.join(dir, `${nm}_combate_${w}.png`) });
    }
  }
  await abrir('lursey-brumaclara', 1440);
  await p.evaluate(() => App.switchTab('bastion')); await sleep(300);
  await p.screenshot({ path: path.join(dir, 'lursey_bastion_1440.png') });
  await p.evaluate(() => App.switchTab('equipo')); await sleep(300);
  await p.screenshot({ path: path.join(dir, 'lursey_equipo_1440.png') });
  await p.evaluate(() => App.openShortRest()); await sleep(400);
  await p.screenshot({ path: path.join(dir, 'lursey_dialogo_1440.png') });
  await abrir('lursey-brumaclara', 480);
  await p.evaluate(() => App.openShortRest()); await sleep(400);
  await p.screenshot({ path: path.join(dir, 'lursey_dialogo_480.png') });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await p.evaluate(() => skipLogin()); await sleep(500);
  await p.screenshot({ path: path.join(dir, 'inicio_1440.png') });
  console.log('capturas en', dir);
  await b.close();
})();
