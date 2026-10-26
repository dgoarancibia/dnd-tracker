// Stonecunning aparece como recurso del Enano con usos = BC (Lursey y un enano cualquiera).
const puppeteer = require('puppeteer-core');
const { CHROME, URL_BASE } = require('./entorno');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = true; const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
const abrir = async (p, id) => {
  await p.evaluate(id => { Storage.setActiveId(id); sessionStorage.setItem('dnd_playing', '1'); }, id);
  await p.goto(URL_BASE + '/app.html?r=' + Date.now(), { waitUntil: 'networkidle2' }); await sleep(2500);
  return p.evaluate(id => (Storage.getChar(id).resources || []).find(r => r.id === 'stonecunning') || null, id);
};
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await browser.newPage();
  p.on('pageerror', e => console.log('ERROR:', e.message));
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1500);
  await p.evaluate(() => {
    localStorage.setItem('dnd_guest', '1');
    const l = Characters.buildLursey(); l.nivel = 7; l.classes[0].level = 7; Storage.saveChar(l);
    const t = Characters.createNew('Torvald', 'Explorador'); t.id = 'tv'; t.nivel = 4; t.raza = 'Enano'; Storage.saveChar(t);
  });
  const sl = await abrir(p, 'lursey-brumaclara');
  chk(sl && sl.max === 3 && sl.recharge === 'long' && sl.action === 'Acción bonus', 'Lursey nv7: Stonecunning 3/3 por descanso largo');
  const st = await abrir(p, 'tv');
  chk(st && st.max === 2, 'Enano nv4: 2 usos');
  // Salir de la ficha antes de editar: el autoguardado al descargar pisaría el cambio
  await p.goto(URL_BASE + '/index.html', { waitUntil: 'networkidle2' }); await sleep(1000);
  await p.evaluate(() => { const t = Storage.getChar('tv'); t.nivel = 5; t.resources.find(r => r.id === 'stonecunning').current = 1; Storage.saveChar(t); });
  const st5 = await abrir(p, 'tv');
  chk(st5 && st5.max === 3 && st5.current === 2, 'al subir a nv5 pasa a 3 usos y suma el nuevo (1 → 2): ' + JSON.stringify(st5 && [st5.current, st5.max]));
  console.log(ok ? '\nTODO OK' : '\nHAY FALLAS');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
