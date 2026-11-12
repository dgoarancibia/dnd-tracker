// Explorador 2024: 3 espacios de nivel 1 en nivel 3 (la mitad redondea hacia arriba);
// una ficha guardada con 2 se corrige al cargar; nivel 4 da la dote y 5 preparados.
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  const res = [];
  const chk = (nombre, ok, dato) => { res.push(ok); console.log(ok ? 'OK ' : 'MAL', nombre, dato !== undefined ? JSON.stringify(dato) : ''); };
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' });
  const t = await p.evaluate(() => ['Explorador', 'Paladín'].map(cl => [1, 2, 3, 4, 5, 9].map(n => { const s = Characters.calcMulticlassSlots([{ name: cl, level: n }]); return [1, 2, 3].map(i => s[i].max).join('/'); }).join(' ')));
  chk('tabla 2024: 2,2,3,3,4/2,4/3/2 para Explorador y Paladín', t.every(x => x === '2/0/0 2/0/0 3/0/0 3/0/0 4/2/0 4/3/2'), t);
  // Ficha vieja: Explorador 3 guardado con 2 espacios (1 gastado)
  await p.evaluate(() => { localStorage.setItem('dnd_guest', '1');
    const c = Characters.createNew('Torvald', 'Explorador'); c.id = 'tv4'; c.nivel = 3; c.subclase = 'Beast Master';
    c.classes = [{ name: 'Explorador', level: 3, subclass: 'Beast Master' }]; c.spellSlots = { 1: { current: 1, max: 2 } };
    Storage.saveChar(c); Storage.setActiveId('tv4'); sessionStorage.setItem('dnd_playing', '1'); });
  await p.goto(URL_BASE + '/app.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  const s3 = await p.evaluate(() => App.getActiveChar().spellSlots[1]);
  chk('al cargar sube a 3 espacios sin devolver el gastado (2/3)', s3.max === 3 && s3.current === 2, s3);
  // Subir por el asistente con Grum (bestia de tierra) herido: gana los 5 PG del nivel
  await p.evaluate(() => { const c = App.getActiveChar(); c.companion = { beast: 'land', summoned: true, name: 'Grum', hp: 18 };
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
    App.openLevelUp(); document.getElementById('luHPGained').value = '6'; App.applyLevelUp(); });
  await sleep(600);
  const n4 = await p.evaluate(() => { const c = App.getActiveChar();
    return { nivel: c.nivel, grum: c.companion.hp, grumMax: Characters.PRIMAL_COMPANION_BEASTS.land.calcMaxHP(4),
      slots: c.spellSlots[1], prep: Characters.getPreparedMaxAtLevel(c, 4), pend: Characters.getPendingChoices(c, 4, 3).map(x => x.id) }; });
  chk('Grum: máximo 25 en nv4 y gana +5 (18 → 23)', n4.nivel === 4 && n4.grumMax === 25 && n4.grum === 23, n4);
  chk('nivel 4: siguen 3 espacios, 5 preparados y pide la mejora/dote', n4.slots.max === 3 && n4.prep === 5 && n4.pend.includes('asi-4'), n4);
  console.log(res.every(Boolean) ? 'TODO OK' : 'HAY FALLAS');
  await browser.close();
})();
